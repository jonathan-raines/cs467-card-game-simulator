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
// The game ticks at the rate of 1 tick per 100 milliseconds (10Hz)
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

const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

let overallDepth = 0;       // Depth of the highest card


/* Global Variables Set outside game.js (Needed to communicate to / from server.js)
const room_io;             // Pass the socket io namespace name
const IS_LOCAL = IS_LOCAL; // Let game.js know if it's running locally for developers
const pool = pool;         // Pass the pool for the database
const roomInfo = roomInfo; // Pass room info to the server instance
let numPlayers = 0;        // Current number of players
*/


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
  debugTicker(self)

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
      if(objectInfoToSend[inputData.objectId] != null)
        objectInfoToSend[inputData.objectId].objectDepth = overallDepth;
    });

    socket.on('mergeStacks', function (inputData) {
      // take all items in top stack and put in bottom stack
      // then delete top stack
      const topStack = self.tableObjects.getChildren()[inputData.topStack-1];
      const bottomStack = self.tableObjects.getChildren()[inputData.bottomStack-1];
      mergeStacks(topStack, bottomStack);
    });

    socket.on('drawTopSprite', function(inputData){
      //find the stack to be drawn from
      const bottomStack = self.tableObjects.getChildren()[inputData.bottomStack-1];
      //select the top sprite in the stack
      const topSprite = bottomStack.last;
      console.log('removing top sprite: ' +  bottomStack.last.frame.name + ', id: ' + topSprite.spriteId)

      //find the original stack that the sprite was created with
      const topStack = self.tableObjects.getChildren()[topSprite.spriteId-1];
      
      //re-define the stack and put its original sprite back into it
      topStack.isActive = true;
      topStack.x = bottomStack.x;
      topStack.y = bottomStack.y;
      topStack.objectId = topSprite.spriteId;
      bottomStack.remove(topSprite);
      topStack.add(topSprite);

      let string = 'bottom local contains: ';
      bottomStack.getAll().forEach(function(sprite){
        string += (sprite.name + ', ')
      });
      console.log(string)

      string = 'top local contains: ';
      topStack.getAll().forEach(function(sprite){
        string += (sprite.name + ', ')
      });
      console.log(string)


      console.log("Changing objectInfoToSend: ")
      //update clients telling them to create the new stack
      objectInfoToSend[topStack.objectId]={
        objectId: topStack.objectId,
        items: [ objectInfoToSend[bottomStack.objectId].items.pop() ],
        x: bottomStack.x,
        y: bottomStack.y,
        objectDepth: overallDepth
      }

      console.log('bottomObjectInfo: ' +objectInfoToSend[bottomStack.objectId].items)
      console.log('topObjectInfo: ' +objectInfoToSend[topStack.objectId].items+'\n')
    });
  });
}

function debugObjectContents(object) {
  console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
  var i = 0;
  object.getAll().forEach(function (sprite) {
    console.log("   [" + i + "]: " + cardNames[sprite.spriteId]);
    i++;
  });
}

function update() {

}

// This is the update() function for the server
function startGameDataTicker(self) {
  let tickInterval = setInterval(() => {
      // Update the object info to send to clients from game objects
      self.tableObjects.getChildren().forEach((object) => {
        if(object.isActive) {
          objectInfoToSend[object.objectId].x = object.x;
          objectInfoToSend[object.objectId].y = object.y;
        }
      });

      // Sends the card positions to clients
      io.emit('objectUpdates', objectInfoToSend);

  }, GAME_TICK_RATE);
}


function debugTicker(self) {
  let tickInterval = setInterval(() => {

      var totalCards = 0;
      self.tableObjects.getChildren().forEach((object) => {
        totalCards += object.length;
      });

      console.log("--Total number of objects: " + totalCards);

  }, 10000); // 10 sec
}


/*---------- objectInfoToSend Example -------------------
objectInfoToSend[3] = {
  objectId: 3,
  items: [3, 5, 8], // SpriteId of the Items in the stack ([0] is bottom of stack and always the same as objectId)
  isFaceUp: [false, false, false], // For flipping Not implemented yet
  x: 100,
  y: 200,
  objectDepth: 200, 
};
---------------------------------------------------------*/
function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();

  const xStart = 100;
  const yStart = 100;
  const xSpacing = 35;
  const ySpacing = 200;
  const perRow = 13;

  //add 52 playing cards in order
  for (let i = 1; i <= 52; i++) {
    overallDepth++;
    var initialX = ((i-1)%perRow) * xSpacing + xStart;
    var initialY = Math.floor((i-1)/perRow) * ySpacing + yStart;
    // Assigns the info to send to clients
    objectInfoToSend[i] = {
      objectId: i,
      items: [i], // Items in the stack, initially just the spriteId for the card
      x: initialX,
      y: initialY,
      objectDepth: overallDepth
    };
    addObject(self, [i], initialX, initialY, frames);
  }
  //gatherAllCards(self);
}

function gatherAllCards(self) {
  const bottomStack = self.tableObjects.getChildren()[0];
  for(let i = 2; i <= 52; i++) {
    let topStack = self.tableObjects.getChildren()[i-1];
    mergeStacks(topStack, bottomStack);
  }
}

function mergeStacks(topStack, bottomStack) {
  // take all items in top stack and put in bottom stack
  // then delete top stack

  if(objectInfoToSend[topStack.objectId] == null) 
    console.log("Cannnot merge: topStack is null");
  else if(objectInfoToSend[bottomStack.objectId] == null) 
    console.log("Cannnot merge: bottomStack is null");
  else {

    const topSprites = topStack.getAll();
    for(var i = 0; i < topSprites.length; i++) {
      bottomStack.add(topSprites[i]); // Copy sprites to bottom stack
      objectInfoToSend[bottomStack.objectId].items.push(topSprites[i].spriteId);
    }
    debugObjectContents(bottomStack);

    topStack.isActive = false;       // Keep for later use
    objectInfoToSend[topStack.objectId] = null; // Don't send to client
  }
}

function addObject(self, spriteIds, x, y, frames) {
  const spritesToAdd = [];
  for(let i = 0; i < spriteIds.length; i++) {
    var spriteId = spriteIds[i];
    spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], frames);
  }

  // Create object that acts like a stack (can have multiple sprites in it) 
  const object = self.add.container(x, y, spritesToAdd);
  object.objectId = spriteIds[0]; // First spriteId is always objectId
  object.setSize(70, 95);
  object.isActive = true;

  self.tableObjects.add(object);  // Add it to the object group
}

// **This might not be needed. We could just keep track of sprite ids in objectInfoToSend
function createSprite(self, spriteId, spriteName, frames) {
  var frame = frames[frames.indexOf(spriteName)];
  // Create sprite
  const sprite = self.add.sprite(0, 0, 'cards', frame);
  sprite.spriteId = spriteId;
  sprite.name = spriteName;
  sprite.displayWidth = 70;
  sprite.displayHeight = 95;
  sprite.isFaceUp = true;
  return sprite;
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