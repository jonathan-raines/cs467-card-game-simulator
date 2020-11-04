var config = {
  type: Phaser.AUTO,
  parent: 'game-area',
  dom: {
    createContainer: true
  },
  // Initial dimensions based on window size
  width: window.innerWidth*.8,
  height: window.innerHeight,
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const STACK_SNAP_DISTANCE = 40;
const MENU_DEPTH = 1000;
const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

var players = {};           // List of all the current players in the game 
var isDragging = -1;        // The id of an object being currently dragged. -1 if not
var draggingObj = null;     // The pointer to the object being currently dragged
var drewAnObject = false;   // Keep track if you drew an item so you don't draw multiple
var updatedCount = 0;       // Keeps track of what items get updated. 
                            // If it doesn't match this val then it should be deleted

// This player's info
var playerNickname = getParameterByName('nickname');
// Room's info from url query
const roomName = '/' + getParameterByName('roomId');

var playerIndicator;

var cam;

var game = new Phaser.Game(config);

function preload() {
  this.load.html('nameform', 'assets/nameform.html');
  this.load.html('playerIndicator', 'assets/playerIndicator.html');
  this.load.html('menu', 'assets/menu.html');
  this.load.html('help', 'assets/help.html');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  var self = this;
  this.socket = io(roomName);

  cam = this.cameras.main;

  var backgroundColor = this.cameras.main.setBackgroundColor('#3CB371');

  debugTicker(self);

  if(playerNickname)
    self.socket.emit('playerNickname', playerNickname);

  this.tableObjects = this.add.group();
  
  startSocketUpdates(self);
  loadMenu(self);
  loadCards(self);
  loadPlayer(self);

  menuCam = self.cameras.add(0, 0, game.config.width, game.config.height);
  menuCam.ignore(self.tableObjects);

  cursors = this.input.keyboard.createCursorKeys();
}

function update() {
  cursors = this.input.keyboard.createCursorKeys();
  if (cursors.up.isDown)
  {
    cam.zoom += 0.005;
  }
  else if (cursors.down.isDown)
  {
    cam.zoom -= 0.005;
  }
}

// Gets url parameters/queries for a name and returns the value
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function loadPlayer(self) {
  playerIndicator = self.add.dom(635, 1250).createFromCache('playerIndicator');
  document.getElementById('btn').innerText = playerNickname;
  
  playerIndicator.on('pointerdown', function() {
    console.log(playerIndicator.x);
    console.log(playerIndicator.y);
  });
}

function loadMenu(self) {
  var menu = self.add.text(20, 10, 'Menu', { 
    color: 'White',
    font: 'bold 34px Arial', 
    align: 'left',
  }).setInteractive();

  menu.depth = 1000;

  menu.on('pointerdown', function() {
    var element = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('menu');

    $('#user-name').val(playerNickname);

    $('#menu-form').submit(function(e) {
      e.preventDefault();
      var newColor = $('#background').val();
      if(newColor != self.backgroundColor) {
        self.backgroundColor = self.cameras.main.setBackgroundColor(newColor);
        self.socket.emit('backgroundColor', newColor);
      }
      newNickname = $('#user-name').val();
      if(playerNickname != newNickname) {
        playerNickname = newNickname;
        self.socket.emit('playerNickname', playerNickname);
      }
    });

    self.input.keyboard.on('keyup-ESC', function (event) {
      element.destroy();
    });

    $('#exit-menu').click(function() {
      element.destroy();
    });
  });

  var help = self.add.text(game.config.width - 80, 10, 'Help', { 
    color: 'White',
    font: 'bold 34px Arial', 
    align: 'left',
  }).setInteractive();

  help.depth = 1000;

  help.on('pointerdown', function() {
    var element = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('help');

    self.input.keyboard.on('keyup-ESC', function (event) {
      element.destroy();
    });

    $('#exit-help').click(function() {
      element.destroy();
    });
  });

  self.cameras.main.ignore(menu);
  self.cameras.main.ignore(help);

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

  //add 52 playing cards in order
  for (let i = 1; i <= 52; i++) {
    let nextCard = frames[frames.indexOf(cardNames[i])];
    addObject(self, i, cardNames[i], nextCard);
  }

  // Add joker card
  var jokerFrame = frames[frames.indexOf("joker")];
  addObject(self, 53, 'joker', jokerFrame);

  // for Thomas this doesnt work
  self.input.mouse.disableContextMenu();

  // Right Click for flip
  self.input.on('pointerdown', function (pointer, targets) {
    if (pointer.rightButtonDown() && targets[0] != null) {
      var orientation = true; // true is face up
      if (targets[0].name == targets[0].frame.name) { //if target cardName == frame name, flip it to back
        // Locally flips the card
        targets[0].setFrame(frames[frames.indexOf("back")]);
        orientation = false;
      } 
      else { //otherwise flip card to front
        // Locally flips the card
        targets[0].setFrame(frames[frames.indexOf(targets[0].objectName)]);
      }
      
      // Send info to server
      self.socket.emit('objectFlip', { 
        objectId: targets[0].objectId,
        isFaceUp: orientation
      });
    }
  });

  // Only pick up the top object
  self.input.topOnly = true;


  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    gameObject.setTint(0xff0000);
    isDragging = gameObject.objectId;
    draggingObj = gameObject;

    console.log("dragging " + draggingObj.first.name + " with " + draggingObj.length + " cards");
    
    draggingObj.depth = MENU_DEPTH-1;
    self.socket.emit('objectDepth', { // Tells the server to increase the object's depth

      objectId: gameObject.objectId
    });
  });
  
 // While the mouse is dragging
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    if( 
      gameObject === draggingObj && 
      draggingObj.length > 1 && 
      pointer.moveTime - pointer.downTime < 500 && 
      pointer.getDistance() > 5
    ) {
      drawTopSprite(self, draggingObj, dragX, dragY, frames);
    }

    dragGameObject(self, draggingObj, dragX, dragY);
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {
    gameObject.setTint(0x00ff00);
    gameObject.clearTint();
    // Waits since there might be lag so last few inputs that the
    // player sends to the server before they put the card down
    // would move the cards
    self.time.delayedCall(500, function() {
      isDragging = -1;
    });
  });  


  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    
    updatedCount = (updatedCount+1)%1000; // keeps track of what local items are updated from server
    Object.keys(objectsInfo).forEach(function (id) {
      if(objectsInfo[id] != null) {
        var updatedAnObject = false;     // if a tableObject is updated = true

        // Go through current objects on table
        self.tableObjects.getChildren().forEach(function (tableObject) {
          if(tableObject.objectId == id) {
            updateObject(self, objectsInfo, id, tableObject, frames);
            updatedAnObject = true
          }
        });

        // item on server doesn't exist on client since no object was updated
        if(!updatedAnObject) {
          // Create object
          console.log("Creating a new object from server");
          var newObj = addObject(self, objectsInfo[id].items, frames);
          //updateObject(self, objectsInfo, id, newObj, frames);
        }
      }
    });
    // check for objects that weren't updated from the server, then delete them
    self.tableObjects.getChildren().forEach(function (object) {
      // if objects dont have the same updated count then they get deleted on the server
      if(updatedCount > object.updated) {
        console.log("removing object deleted from server");
        object.removeAll(true);
        object.destroy();
      }
    });
    
    //updateTableObjects(self, objectsInfo);
  });
}

function updateTableObjects(self, objectsInfo) {

}

function updateObject(self, objectsInfo, id, object, frames) {
  if(!object) { 
    console.log("No local object to update.");
  } else {
    object.updated = updatedCount; // Show that this object was updated
    // Check if it is not being currently dragged or drawn
    if(isDragging != object.objectId) {
      // Check if it's not in the same position
      if(object.x != objectsInfo[id].x || object.y != objectsInfo[id].y) {
        // Update position
        object.setPosition(objectsInfo[id].x, objectsInfo[id].y);
      }
      // Check if different depth
      if(object.depth != objectsInfo[id].objectDepth) {
        // Update Depth
        object.depth = objectsInfo[id].objectDepth;
      }
    }
    // Update sprite list
    var serverSpriteIdArray = objectsInfo[id].items; // array of spriteId
    for (var i = 0; i < serverSpriteIdArray.length; i++) {
      var serverSpriteId = serverSpriteIdArray[i];
      // if there are more server sprites than local
      if(i >= object.getAll().length) {   
        // Create a new sprite
        var newSprite = createSprite(self, serverSpriteId, cardNames[serverSpriteId], frames);
        object.addAt(newSprite, i);
      } 
      // Update sprite
      else if(object.getAll()[i].spriteId == serverSpriteId) {
      //else {
        object.getAll()[i].spriteId = serverSpriteId;
        object.getAll()[i].name = cardNames[serverSpriteId];
        object.getAll()[i].setFrame(frames[frames.indexOf(cardNames[serverSpriteId])]);
        object.getAll()[i].isFaceUp = true;
      }
      // Stack's Parallax Visual Effect 
      stackVisualEffect(object.getAll()[i], i, serverSpriteIdArray.length-1);
    }
  }
  // set the rotation of cards locally. Setting object.rotation directly does not work
  // properly for some reason
  if (object.rotation !== objectsInfo[id].rotation) {
    object.setRotation = objectsInfo[id].rotation;
  }
}

function startSocketUpdates(self) {
  // Get background color
  self.socket.on('backgroundColor', function(color) {
    self.backgroundColor = self.cameras.main.setBackgroundColor(color);
  });

  // Gets the list of current players from the server
  self.socket.on('currentPlayers', function (playersInfo) {
    players = playersInfo;


    for (x in players) {
      if (players[x].playerId === self.socket.id) {
        if (players[x].playerNum % 4 === 0) {
          cam.rotation = 2 * players[x].playerSpacing;
        } else if (players[x].playerNum % 2 === 0) {
          cam.rotation = -(players[x].playerSpacing);
        } else {
          cam.rotation = players[x].playerSpacing;
        }
      }
    }
  });

  // Setup Chat
  $('#chat-form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    self.socket.emit('chat message', playerNickname + ': ' + $('#chat-msg').val());
    $('#chat-msg').val('');
    return false;
  });

  self.socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });
}

function addObject(self, objectId, objectName, frame) {
  // Create object
  // No physics for client side
  const object = self.add.sprite(0, 0, 'cards', frame).setInteractive();

  // Assign the individual game object an id and name
  object.objectId = objectId;
  object.name = objectName;

  self.input.setDraggable(object);

  // Add it to the object group
  self.tableObjects.add(object);
  
  // Change color on hover
  object.on('pointerover', function () {
    this.setTint(0x00ff00);
  });
  return closestObj;
}

//updates gameObject location by dragX, dragY
function dragGameObject(self, gameObject, dragX, dragY){
  if(gameObject) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;
    // Send the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  }
}

function drawTopSprite(self, gameObject, dragX, dragY, frames){
  // Make sure you only draw once
  if(!drewAnObject) {
    self.socket.emit('drawTopSprite', {
      bottomStack: gameObject.objectId
    });

    let drawnSpriteId = draggingObj.last.spriteId;
    console.log(draggingObj.last.name + " is being drawn from the stack");
    draggingObj.remove(draggingObj.last, true);

    draggingObj = addObject(self, [drawnSpriteId], frames);
    draggingObj.depth = MENU_DEPTH-1;
    isDragging = draggingObj.objectId;
    
    drewAnObject = true;
  }
}

function debugObjectContents(object) {
  console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
  var i = 0;
  object.getAll().forEach(function (sprite) {
    console.log("   [" + i + "]: " + cardNames[sprite.spriteId]);
    i++;

  });

function debugTicker(self) {
  let tickInterval = setInterval(() => {

      var totalCards = 0;
      self.tableObjects.getChildren().forEach((object) => {
        totalCards += object.length;
      });

      console.log("--Total number of objects: " + totalCards);

  }, 10000); // 10 sec

}
