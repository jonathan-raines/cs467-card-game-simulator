const config = {
  type: Phaser.HEADLESS,
  width: 800,
  height: 600,
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
// Length of time the server will wait to close after all the players have left
const ROOM_TIMEOUT_LENGTH = 1800000; // 30 min
// How often the server will check if there are any players
const CHECK_ROOM_INTERVAL = 300000; // 5 min
// The game ticks at the rate of 1 tick per 100 milliseconds (10Hz)
const GAME_TICK_RATE = 100

// Global Objects
//--------------------------------------------------------------------------------------------
const objectInfoToSend = {};            // Object to send in objectUpdates
const players = {};                     // Info of all the current players in the game session

// Global Variables
//--------------------------------------------------------------------------------------------
/* Global Variables Set outside game.js (Needed to communicate to / from server.js)
const room_io;             // Pass the socket io namespace name
const IS_LOCAL = IS_LOCAL; // Let game.js know if it's running locally for developers
const pool = pool;         // Pass the pool for the database
const roomInfo = roomInfo; // Pass room info to the server instance
let numPlayers = 0;        // Current number of players
*/
const roomName = roomInfo.roomName;
const maxPlayers = roomInfo.maxPlayers;
let backgroundColor = getRandomColor(); // Table surface color for the room
let overallDepth = 0;                   // Depth of the highest card

const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

function preload() {
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  // For passing this pointer to other functions
  const self = this;
  
  this.tableObjects = this.physics.add.group();             // This is the gameScene's group of objects

  loadCards(self);

  let frames = self.textures.get('cards').getFrameNames();
  
  startGameDataTicker(self);
  //debugTicker(self)

  // When a connection is made
  io.on('connection', function (socket) {
    addPlayer(socket);
    startSocketUpdates(self, socket, frames);
  });
}

function startSocketUpdates(self, socket, frames) {
  // Assigns a nickname 
  socket.on('playerNickname', function(name) {
    
    console.log('[Room ' +  roomName + '] '+
                players[socket.id].name + 
                ' changed their name to ' + name);   
    players[socket.id].name = name;   
  });

  socket.emit('backgroundColor', backgroundColor);

  socket.on('backgroundColor', function(color) {
    backgroundColor = color;
    socket.emit('backgroundColor', color);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  // Listens for when a user is disconnected
  socket.on('disconnect', function () {
    removePlayer(socket);
  });

  // Listens for object movement by the player
  socket.on('objectInput', function (inputData) {
    var obj = getTableObject(self, inputData.objectId);
    if(obj)
        obj.setPosition(inputData.x, inputData.y);
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
    //const topStack = self.tableObjects.getChildren()[inputData.topStack-1];
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
    var objToFlip = getTableObject(self, inputData.objectId);
    flipObject(self, objToFlip);
  });

  socket.on('shuffleStack', function(inputData){
    const originStack = self.tableObjects.getChildren()[inputData.objectId-1];
    shuffleStack(self, originStack);
  });
}

function update() {

}

// This is the update() function for the server
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

  }, GAME_TICK_RATE);
}

function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
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
        console.log('Server ' + roomName + ' stopped.');
        ;(async function() {
          if(!IS_LOCAL) {
            var query = "DELETE FROM rooms WHERE room_name = '" + roomName + "'";
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
