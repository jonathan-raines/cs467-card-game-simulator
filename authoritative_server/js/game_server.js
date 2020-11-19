const config = {
  type: Phaser.HEADLESS,
  width: 1000,
  height: 1000,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  audio: {
    disableWebAudio: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: {
        y: 0
      }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  autoFocus: false
};

// Global Constants
//--------------------------------------------------------------------------------------------

const ROOM_TIMEOUT_LENGTH = 1800000;//(30min) Length of time the server will wait to close after all the players have left
const CHECK_ROOM_INTERVAL = 300000; // (5min) How often the server will check if there are any players
const GAME_TICK_RATE = 50;         // (10hz) The game ticks at the rate of 1 tick per 100 milliseconds (10Hz)
const SLOW_TO_FAST_TICK = 100;      // (.1hz) How many fast ticks per slow ticks (for slow updates to client)
const TABLE_CENTER_X = 0;
const TABLE_CENTER_Y = 0;
const DISTANCE_FROM_CENTER = 400;
const HAND_WIDTH = 280;
const HAND_HEIGHT = 75;
const HAND_SPACING = 50;
const CARD_WIDTH = 70;
const CARD_HEIGHT = 95;

// Global Objects
//--------------------------------------------------------------------------------------------
const objectInfoToSend = {};        // Object to send in objectUpdates
const players = {};                 // Info of all the current players in the game session
const cursorInfo = {};
const options = {};                 // Options for the game
const recentlyShuffled = [];        // Recently shuffled stacks
options["lockedHands"] = true;     // If true, players can only take cards from their own hand.
options["flipWhenExitHand"] = false; // If true, when leaving a hand, cards will automatically flip to hide.
  
// Global Variables
//--------------------------------------------------------------------------------------------
/* Global Variables Set outside game.js (Needed to communicate to / from server.js)
const room_io;             // Pass the socket io namespace name
const IS_LOCAL = IS_LOCAL; // Let game.js know if it's running locally for developers
const pool = pool;         // Pass the pool for the database
const roomInfo = roomInfo; // Pass room info to the server instance
let numPlayers = 0;        // Current number of players
*/
const roomCode = roomInfo.roomCode;
const maxPlayers = roomInfo.maxPlayers;
let playerCounter = 0;
let overallDepth = 0;                   // Depth of the highest card
let tickCount = 0;                      // When

let frames;
const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

var seats = {};
for(var i = 1; i <= 8; i++) {
  var angle = (i-1) * 45;
  var numAsString = i.toString(10);

  seats[numAsString] = {
    id: numAsString,
    name: 'Open',
    x: TABLE_CENTER_X + DISTANCE_FROM_CENTER * Math.sin(Phaser.Math.DegToRad(angle)),
    y: TABLE_CENTER_Y + DISTANCE_FROM_CENTER * Math.cos(Phaser.Math.DegToRad(angle)),
    available: true,
    rotation: angle,
    transform: 0,
    socket: 0
  };
}

function preload() {
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  // For passing this pointer to other functions
  const self = this;
  
  this.tableObjects = this.physics.add.group();             // This is the gameScene's group of objects
  //this.hands = this.physics.add.group();

  loadCards(self);

  frames = self.textures.get('cards').getFrameNames();
  
  startGameDataTicker(self);
  //debugTicker(self)

  // When a connection is made
  io.on('connection', function (socket) {
    addPlayer(self, socket);
    io.emit('defaultName', players[socket.id].name);
    addPlayerToDB();
    io.emit('seatAssignments', seats);
    io.emit('options', options);
    startSocketUpdates(self, socket, frames);
  });
}

function startSocketUpdates(self, socket, frames) {
  // Assigns a nickname 
  socket.on('playerNickname', function(name) {
    console.log('[Room ' +  roomCode + '] '+
                players[socket.id].name + 
                ' changed their name to ' + name);   
    players[socket.id].name = name; 

    for (var x in seats) {
      if (seats[x].socket == socket.id) {
        seats[x].name = name;
      }
    }
    io.emit('nameChange', players);
    io.emit('seatAssignments', seats);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('seatSelected', function(seat) {
    seats[seat.id].socket = seat.socket;
    seats[seat.id].name = seat.name;
    seats[seat.id].available = false;
    players[seat.socket].playerSpacing = seat.playerSpacing;
    players[seat.socket].x = seat.x;
    players[seat.socket].y = seat.y;
    io.emit('seatAssignments', seats);
  });

  // Listens for when a user is disconnected
  socket.on('disconnect', function () {
    removePlayerFromDB();
    for (var x in seats) {
      if (seats[x].socket == socket.id) {
        seats[x].name = 'Open';
        seats[x].available = true;
        seats[x].socket = 0;
      }
    }
    io.emit('seatAssignments', seats); 
    removePlayer(self, socket);
  });

  // Listens for object movement by the player
  socket.on('objectInput', function (inputData) {
    if(!inputData.playerId) { 
        var obj = getTableObject(self, inputData.objectId);
        if(obj)
          obj.setPosition(inputData.x, inputData.y);
    }
    else {
      setHandObjectPosition(self, socket, inputData.playerId, inputData.objectId, inputData.x, inputData.y);
    }
  });

  socket.on('objectRotation', function (inputData) {
    const object = getTableObject(self, inputData.objectId);
    if(object)
      object.angle = inputData.angle;
  });

  // Updates the depth when player picks up a card
  socket.on('objectDepth', function (inputData) {
    overallDepth++; // increases the depth everytime the player picks it up
    if(objectInfoToSend[inputData.objectId] != null)
      objectInfoToSend[inputData.objectId].objectDepth = overallDepth;
  });

  socket.on('mergeStacks', function (inputData) {
    // take all items in top stack and put in bottom stack
    // then delete top stack
    const topStack = getTableObject(self, inputData.topStack);
    const bottomStack = getTableObject(self, inputData.bottomStack);
    mergeStacks(topStack, bottomStack);
  });

  socket.on('drawTopSprite', function(inputData){
    //find the stack to be drawn from
    const bottomStack = getTableObject(self, inputData.bottomStack);
    drawTopSprite(self, bottomStack);
  });

  // Updates the card face when player picks up a card
  socket.on('objectFlip', function (inputData) {
    if(inputData.playerId)
      flipHandObject(self, inputData.objectId, inputData.playerId);
    else {
      var objToFlip = getTableObject(self, inputData.objectId);
      flipTableObject(self, objToFlip);
    }
  });

  socket.on('dummyCursorLocation', function(inputData){
    cursorInfo[inputData.playerId]=inputData;
  });

  socket.on('shuffleStack', function(inputData){
    const originStack = self.tableObjects.getChildren()[inputData.objectId-1];
    shuffleStack(self, originStack);
  });

  socket.on('objectToHand', function(inputData){
    const object = getTableObject(self, inputData.objectId);
    moveObjectToHand(self, object, inputData.playerId, inputData.pos);
  });

  socket.on('handToTable', function(inputData){
    takeFromHand(self, socket, inputData.playerId, inputData.objectId, inputData.x, inputData.y);
  });

  socket.on('handToHand', function(inputData){
    moveAroundInHand(self, inputData.playerId, inputData.objectId, inputData.pos);
  });
}

function update() {}

// For information that users don't need immediately
function slowUpdates(self) {
  tickCount++;
  if(tickCount >= SLOW_TO_FAST_TICK) {

    io.emit('options', options);

    tickCount = 0;
  }
}

// This is the update() function for the server for quick updates
function startGameDataTicker(self) {
  let tickInterval = setInterval(() => {
      // Update the object info to send to clients from game objects
      self.tableObjects.getChildren().forEach((object) => {
        if(object.active) {
          objectInfoToSend[object.objectId].x = object.x;
          objectInfoToSend[object.objectId].y = object.y;
          objectInfoToSend[object.objectId].angle = object.angle;
        }
      });

      // Sends the card positions to clients
      io.emit('objectUpdates', objectInfoToSend);
      io.emit('currentPlayers', players);
      io.emit('moveDummyCursors', cursorInfo);
      slowUpdates(self);

  }, GAME_TICK_RATE);
}

// ----------------- MAIN ------------------------------------
// Start running the game
const game = new Phaser.Game(config);

// Timer to close server if inactive
var timer = setInterval(function() {
  // Check how many players
  if(numPlayers <= 0) {
    // Wait
    setTimeout(function() { 
      // Check again and see if still no players
      if(numPlayers <= 0) {
        clearInterval(timer);
        console.log('Server ' + roomCode + ' stopped.');
        ;(async function() {
          if(!IS_LOCAL) {
            const query = {
              text: "DELETE FROM rooms WHERE room_code = $1",
              values: [roomCode]
            };
            const client = await pool.connect();
            await client.query(query);
            client.release();
          }
        })().catch( e => { console.error(e) }).then(() => {
          game.destroy(true, true);
          window.close(); 
        });
      }
    }, ROOM_TIMEOUT_LENGTH);
  }
}, CHECK_ROOM_INTERVAL);

function addPlayerToDB(){
  if(!IS_LOCAL) {
    (async function() {
      let query = {
        text: "SELECT * FROM rooms WHERE room_code = $1",
        values: [roomCode]
      };
      const client = await pool.connect();
      await client.query(query)
        .then(res =>{
          let curSize = res.rows[0].num_players;
          (async function() {
            let query = {
              text: "UPDATE rooms SET num_players = $1 WHERE room_code = $2",
              values: [curSize+1, roomCode]
            };
            const client = await pool.connect();
            await client.query(query).catch(e => console.error(e.stack));
            client.release();
          })().catch( e => { console.error(e) });
        }).catch(e => console.error(e.stack));
      client.release();
    })().catch( e => { console.error(e) });
  } 
}

function removePlayerFromDB(){
  if(!IS_LOCAL) {
    (async function() {
      let query = {
        text: "SELECT * FROM rooms WHERE room_code = $1",
        values: [roomCode]
      };
      const client = await pool.connect();
      await client.query(query)
        .then(res =>{
          let curSize = res.rows[0].num_players;
          (async function() {
            let query = {
              text: "UPDATE rooms SET num_players = $1 WHERE room_code = $2",
              values: [curSize-1, roomCode]
            };
            const client = await pool.connect();
            await client.query(query).catch(e => console.error(e.stack));
            client.release();
          })().catch( e => { console.error(e) });
        }).catch(e => console.error(e.stack));
      client.release();
    })().catch( e => { console.error(e) });
  }
}