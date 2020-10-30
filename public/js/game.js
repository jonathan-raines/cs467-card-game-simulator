
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

const STACK_SNAP_DISTANCE = 25;
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
var updatedCount = 0;       // Keeps track of what items get updated. 
                            // If it doesn't match this val then it should be deleted



// This player's info
var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomName = '/' + getParameterByName('roomId');

var game = new Phaser.Game(config);

function preload() {
  this.load.html('nameform', 'assets/nameform.html');
  this.load.html('menu', 'assets/menu.html');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  var self = this;
  this.socket = io(roomName);

  var backgroundColor = this.cameras.main.setBackgroundColor('#3CB371');

  if(playerNickname)
    self.socket.emit('playerNickname', playerNickname);

  this.tableObjects = this.add.group();
  
  loadMenu(self);
  loadCards(self);
  startSocketUpdates(self);
}

function update() {}

// Gets url parameters/queries for a name and returns the value
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function loadMenu(self) {
  var menu = self.add.text(20, 10, 'Menu', { 
    color: 'White',
    font: 'bold 34px Arial', 
    align: 'left',
    backgroundColor: "Black"
  }).setInteractive();

  menu.depth = MENU_DEPTH;

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
}

function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();

  // for Thomas this doesnt work
  self.input.mouse.disableContextMenu();

  // Only pick up the top object
  self.input.topOnly = true;

  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    isDragging = gameObject.objectId;
    gameObject.depth = MENU_DEPTH-1;  // Bring to front
    self.socket.emit('objectDepth', { // Tells the server to increase the object's depth
      objectId: gameObject.objectId
    });
  });
  
  // While the mouse is dragging
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;
    // Send the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {
    self.time.delayedCall(500, function() { // Waits for the chance of lag
      isDragging = -1;                      // Assumes the player is still dragging
    });                                     // would move the cards
    onObjectDrop(self, gameObject); 
  });  

  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    updatedCount = (updatedCount+1)%100; // keeps track of what local items are updated from server
    Object.keys(objectsInfo).forEach(function (id) {
      if(objectsInfo[id] != null) {
        var updatedAnObject = false;     // if a tableObjec is updated = true
        // Go through current objects on table
        self.tableObjects.getChildren().forEach(function (tableObject) {
          if(tableObject.objectId == id) {
            updateObject(self, objectsInfo, id, tableObject, frames);
            updatedAnObject = true
          }
        });
        // item on server doesn't exist on client
        if(!updatedAnObject) {
          // Create object
          addObject(self, objectsInfo[id].items, frames);
        }
      }
    });
    // check for objects that weren't updated from the server, then delete them
    self.tableObjects.getChildren().forEach(function (object) {
      // if objects dont have the same updated count then they get deleted on the server
      if(updatedCount != object.updated) {
        object.removeAll(true);
        object.destroy();
      }
    });
  });
}

function updateObject(self, objectsInfo, id, object, frames) {
  if(!object) { 
    console.log("No local object to update.");
  } else if(objectsInfo[id] != null) {
    object.updated = updatedCount; // Show that this object was updated
    // Check if it is not being currently dragged
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
    //var object.getAll() = object.getAll();   // array of sprites gameobjects
    for (var i = 0; i < serverSpriteIdArray.length; i++) {
      var serverSpriteId = serverSpriteIdArray[i];
      if(i >= object.getAll().length) {   // There are more server sprites than local
        // Create a new sprite
        var newSprite = createSprite(self, serverSpriteId, cardNames[serverSpriteId], frames);
        object.addAt(newSprite, i);
      } 
      // Update sprite
      else if(object.getAll()[i].spriteId == serverSpriteId) {
        object.getAll()[i].spriteId = serverSpriteId;
        object.getAll()[i].name = cardNames[serverSpriteId];
        object.getAll()[i].setFrame(frames[frames.indexOf(cardNames[serverSpriteId])]);
        object.getAll()[i].isFaceUp = true;
      }
      // Stack's Parallax Visual Effect 
      stackVisualEffect(object.getAll()[i], i, serverSpriteIdArray.length-1);
    }
    object.getAll().splice(i, object.getAll().length); // Delete all the extra sprites
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

// May have multiple sprites for an object (in the case of a stack)
function addObject(self, spriteIds, frames) {
  const spritesToAdd = []; // Array of sprite objects to add to stack container
  // first spriteId will always equal the objectId
  for(let i = 0; i < spriteIds.length; i++) {
    var spriteId = spriteIds[i];
    spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], frames);

    // Stack's Parallax Visual Effect 
    stackVisualEffect(spritesToAdd[i], i, spriteIds.length-1);
    //spritesToAdd[i].x = -Math.floor((spriteIds.length-i)/7);
    //spritesToAdd[i].y = Math.floor((spriteIds.length-i)/4);
  }
  // Create a stack-like object (can have multiple sprites in it)/(No physics for client side)
  const object = self.add.container(0,0, spritesToAdd); // Server will move it with 'ObjectUpdates'
  object.objectId = spriteIds[0];  // First spriteId is always objectId
  object.setSize(70, 95);
  object.setInteractive();         // Make interactive with mouse
  object.updated = updatedCount;
  self.input.setDraggable(object);

  self.tableObjects.add(object);   // Add it to the object group
}

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

// Makes a stack of cards look 3D
function stackVisualEffect(sprite, pos, size) {
  sprite.x = -Math.floor((size-pos)/10);
  sprite.y = Math.floor((size-pos)/5);
}

// Called when an object is dropped
function onObjectDrop(self, gameObject) {
  // Find closest object to snap to
  var closest = findSnapObject(self, gameObject);
  if(closest != null) {
    // Snap to position
    gameObject.x = closest.x;
    gameObject.y = closest.y;
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: closest.x, 
      y: closest.y 
    });
    // Merge the two stacks
    self.socket.emit('mergeStacks', { 
      topStack: gameObject.objectId,
      bottomStack: closest.objectId
    });
  } 
}

// Finds the first object within the snap distance, returns null if there are none
function findSnapObject(self, gameObject) {
  var closestObj = null;
  var distance = STACK_SNAP_DISTANCE;
  self.tableObjects.getChildren().forEach(function (tableObject) {
    if (gameObject !== tableObject) {
      var tempDistance = Phaser.Math.Distance.BetweenPoints(gameObject, tableObject);
      if(tempDistance < distance) {
      closestObj = tableObject;
      distance = tempDistance
      }
    }
  });
  return closestObj;
}