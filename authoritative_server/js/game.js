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

// Length of time the server will wait to close after all the players have left
const ROOM_TIMEOUT_LENGTH = 1800000; // 30 min
// How often the server will check if there are any players
const CHECK_ROOM_INTERVAL = 300000; // 5 min
// The game ticks at the rate of 1 tick per 100 milliseconds
const GAME_TICK_RATE = 100

const roomName = roomInfo.roomName;
const maxPlayers = roomInfo.maxPlayers;
let backgroundColor = getRandomColor();

// Global all objects reference
// This keeps track of object position and other info to send to the users
// This has to be updated with information from the game environment as it 
// is seperate from the game objects
const objectInfoToSend = {};

// Info of all the current players in the game session
const players = {};

// Number of current players in the game session
//let numPlayers = 0;

// Depth of the highest card
var overallDepth = 0;



function preload() {
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  // For passing this pointer to other functions
  const self = this;

  // Makes this.objects a group of sprites with physics
  // This is the gameScene's group of objects
  this.tableObjects = this.physics.add.group();

  loadCards(self);
  let frames = self.textures.get('cards').getFrameNames();
  
  startGameDataTicker(self);

  // When a connection is made
  io.on('connection', function (socket) {
    numPlayers++;
    players[socket.id] = {
      playerId: socket.id,
      name: "player" + numPlayers,
      playerNum: numPlayers       // player's number that's not long
    };
    // Assigns a nickname 
    socket.on('playerNickname', function(name) {
      players[socket.id].name = name;
      console.log('[Room ' +  roomName + '] Player ' + players[socket.id].playerNum + 
                  ' changed their name to ' + name);      
      // Send the new info out
      socket.emit('currentPlayers', players);
    });

    console.log('[Room ' +  roomName + '] Player ' + players[socket.id].playerNum + 
                ' (' + players[socket.id].name + ') connected');

    socket.emit('currentPlayers', players);
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
      console.log('[Room ' +  roomName + '] Player ' + players[socket.id].playerNum + 
                  ' (' + players[socket.id].name + ') disconnected');
      delete players[socket.id];
      numPlayers--;
      // emit a message to all players to remove this player
      socket.emit('currentPlayers', players);
    });

    // Listens for object movement by the player
    socket.on('objectInput', function (inputData) {
      // Finds the object by id
      // tableObjects.getChildren() is based of when the sprites were addded
      // to the group (here it is one off)
      var obj = self.tableObjects.getChildren()[inputData.objectId-1];
      if(obj)
          obj.setPosition(inputData.x, inputData.y);
    });

    // Updates the depth when player picks up a card
    socket.on('objectDepth', function (inputData) {
      overallDepth++; // increases the depth everytime the player picks it up
      objectInfoToSend[inputData.objectId].objectDepth = overallDepth;
    });
    
    // Listens for object movement by the player
    socket.on('objectFlip', function (inputData) {
      objectInfoToSend[inputData.objectId].isFaceUp = inputData.isFaceUp;
    });
  });
}

function update() {
  /*
  // Update the object info to send to clients from game objects
  this.tableObjects.getChildren().forEach((object) => {
    objectInfoToSend[object.objectId].x = object.x;
    objectInfoToSend[object.objectId].y = object.y;
  });
  // Sends the card positions to clients
  io.emit('objectUpdates', objectInfoToSend);
  */
}

// This is the update() function for the server
function startGameDataTicker(self) {
  
  let tickInterval = setInterval(() => {

      // Update the object info to send to clients from game objects
      self.tableObjects.getChildren().forEach((stack) => {
        objectInfoToSend[stack.stackId].x = stack.x;
        objectInfoToSend[stack.stackId].y = stack.y;

      });
      // Sends the card positions to clients
      io.emit('objectUpdates', objectInfoToSend);

  }, GAME_TICK_RATE);
  
}

function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();

  let cardNames = ['back', 
    'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
    'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
    'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
    'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
    'joker'
  ];

  const xStart = 100;
  const yStart = 100;
  const xSpacing = 35;
  const ySpacing = 200;
  const perRow = 13;

  //add 52 playing cards in order
  for (let i = 1; i <= 52; i++) {
    let nextCard = frames[frames.indexOf(cardNames[i])];
    overallDepth++;
    // Assigns the info to send to clients
    // initial position and information
    objectInfoToSend[i] = {
      x: ((i-1)%perRow) * xSpacing + xStart,
      y: Math.floor((i-1)/perRow) * ySpacing + yStart,
      objectId: i,
      objectName: cardNames[i],
      objectDepth: overallDepth,
      isFaceUp: true  
    };
    addObject(self, objectInfoToSend[i], cardNames[i], nextCard);
  }

  
  //display joker card
  let jokerFrame = frames[frames.indexOf("joker")];
  let jokerId = 53;
  objectInfoToSend[jokerId] = {
    x: ((jokerId-1)%perRow) * xSpacing + xStart,
    y: Math.floor((jokerId-1)/perRow) * ySpacing + yStart,
    objectId: jokerId,
    isFaceUp: true  
  };
  addObject(self, objectInfoToSend[jokerId], cardNames[jokerId], jokerFrame);
}

function addObject(self, objectInfo, objectName, frame) {
  // Create object 
  // physics is used for future features
  const object = self.physics.add.sprite(objectInfo.x, objectInfo.y, 'cards', frame);
  // Assign the individual game object an id
  object.objectId = objectInfo.objectId;
  object.name = objectName;

  const stack = self.add.container(objectInfo.x, objectInfo.y, object);
  stack.stackId = objectInfo.objectId;  

  // Add it to the object group
  self.tableObjects.add(stack);
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