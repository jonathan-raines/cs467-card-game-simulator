
var config = {
  type: Phaser.AUTO,
  parent: 'game-area',
  dom: {
    createContainer: true
  },
  // Initial dimensions based on window size
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const STACK_SNAP_DISTANCE = 40;
const MENU_DEPTH = 1000;
const LONG_PRESS_TIME = 300;

const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

var players = {};           // List of all the current players in the game 
var isDragging = -1;        // The id of an object being currently dragged. -1 if not
var wasDragging = -1;       // Obj id that was recently dragged. For lag compensation.
var draggingObj = null;     // The pointer to the object being currently dragged
var drewAnObject = false;   // Keep track if you drew an item so you don't draw multiple


// This player's info
var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomName = '/' + getParameterByName('roomId');

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
  
  loadMenu(self);
  loadCards(self);
  startSocketUpdates(self); 

  cursors = this.input.keyboard.createCursorKeys();

  this.input.on('pointermove', pointer => {
    if (pointer.middleButtonDown()) {
      cam.pan(pointer.x, pointer.y);
    }
  });

  this.input.on('wheel', function(pointer, currentlyOver, deltaX, deltaY, deltaZ, event) { 
    cam.zoom += deltaY * -.001;
  });

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
  var menu, help;
  // jQuery to  interact with Menu HTML element
  $('#menu-button').click(function() {
    menu = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('menu');

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
      menu.destroy();
    });

    $('#exit-menu').click(function() {
      menu.destroy();
    });
  });

  // jQuery to intereact with Help HTML element
  $('#help-button').click(function() {
    help = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('help');

    self.input.keyboard.on('keyup-ESC', function (event) {
      help.destroy();
    });

    $('#exit-help').click(function() {
      help.destroy();
    });
  });
}

function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();

  // for Thomas this doesnt work
  self.input.mouse.disableContextMenu();

  // Only pick up the top object
  self.input.topOnly = true;

  /*
  // ***************** BUGGY ******************
  var keyF = self.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
  self.input.on('pointerover', function(pointer, justOver){
    
    keyF.on('down', function (key, event) {

      var object = justOver[0];
      console.log("card: " + object.first.name);
      flipObject(self, object, frames);
      
      //keyF.off('down');
    });
  });  
  self.input.on('pointerout', function(pointer, justOut){
    keyF.off('down');
  });
  */

  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    isDragging = gameObject.objectId;
    draggingObj = gameObject;
    
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
      pointer.moveTime - pointer.downTime < LONG_PRESS_TIME
      // This makes the deck slightly drag when drawing from it
       //&& pointer.getDistance() > 5
    ) {
      drawTopSprite(self, frames);
    }

    dragGameObject(self, draggingObj, dragX, dragY);
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {

    onObjectDrop(self, draggingObj, frames); 

    wasDragging = isDragging;
    isDragging = -1; 
    draggingObj = null;
    drewAnObject = false;

    setTimeout(function(){ 
      wasDragging = -1;
    }, 300);
  });  


  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    updateTableObjects(self, objectsInfo, frames);
  });
}

// Updates all the objects on the table
function updateTableObjects(self, objectsInfo, frames) {
  Object.keys(objectsInfo).forEach(function (id) {
    if(objectsInfo[id] != null) {
      var updatedAnObject = false;
      self.tableObjects.getChildren().forEach(function (object) {
        // Check if server has object
        if(objectsInfo[object.objectId] == null) {
          // Check if it's being or was recently dragged
          if(isDragging != object.objectId && wasDragging != object.objectId) {
            object.removeAll(true);
            object.destroy();
          }
        }

        // Check if object is same as server's object
        else if(object.objectId == id) {
          updateObject(self, objectsInfo, id, object, frames);
          updatedAnObject = true;
        } 
      });

      // If no object was updated, there is no local object and must be created
      if(!updatedAnObject && objectsInfo[id] != null) {
        addObject(self, objectsInfo[id].items, objectsInfo[id].x, objectsInfo[id].y, objectsInfo[id].isFaceUp, frames);
      }
    }
  });
}


// Updates a single table object
function updateObject(self, objectsInfo, id, object, frames) {
  if(!object) { 
    console.log("No local object to update.");
  } else {
    // Check if it is not being currently dragged or drawn
    if(isDragging != object.objectId && wasDragging != object.objectId) {
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

      object.angle = objectsInfo[id].angle;

    }
    // Update all sprites (regardless if its being dragged)
    var serverSpriteIdArray = objectsInfo[id].items;

    for (i = 0; i < Math.max(object.length, serverSpriteIdArray.length); i++) {

      if(i >= object.length) {
        // Create a new sprite
        var newSprite = createSprite(self, serverSpriteId, cardNames[serverSpriteId], objectsInfo[id].isFaceUp[i], frames);
        object.add(newSprite); // Add at end of list
      }
      else if(i >= serverSpriteIdArray.length) {
        // Delete Sprite
        object.removeAt(i, true);
      }
      else {
        var serverSpriteId = serverSpriteIdArray[i];
        var spriteToUpdate = object.getAt(i);

        // Update the sprite
        updateSprite(spriteToUpdate, serverSpriteId, objectsInfo[id].isFaceUp[i], frames);

        // Stack's Parallax Visual Effect 
        stackVisualEffect(spriteToUpdate, i, serverSpriteIdArray.length-1);
      }
    }
  }
}

// Update a sprite
function updateSprite(oldSprite, newId, newIsFaceUp, frames) {
  if(oldSprite) {
    oldSprite.spriteId = newId;
    oldSprite.name = cardNames[newId];
    if(newIsFaceUp) 
      oldSprite.setFrame(frames[frames.indexOf(cardNames[newId])]);
    else
      oldSprite.setFrame(frames[frames.indexOf('back')]);
    oldSprite.isFaceUp = newIsFaceUp;
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
    cam.setAngle(players[self.socket.id].playerSpacing);
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
function addObject(self, spriteIds, x, y, spriteOrientations, frames) {
  const spritesToAdd = []; // Array of sprite objects to add to stack container
  // first spriteId will always equal the objectId
  for(let i = 0; i < spriteIds.length; i++) {
    var spriteId = spriteIds[i];
    spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], spriteOrientations[i], frames);

    // Stack's Parallax Visual Effect 
    stackVisualEffect(spritesToAdd[i], i, spriteIds.length-1);
  }
  // Create a stack-like object (can have multiple sprites in it)/(No physics for client side)
  const object = self.add.container(x, y, spritesToAdd); // Server will move it with 'ObjectUpdates'
  object.objectId = spriteIds[0];  // First spriteId is always objectId
  object.setSize(70, 95);
  object.setInteractive();         // Make interactive with mouse
  self.input.setDraggable(object);

  self.tableObjects.add(object);   // Add it to the object group
  return object;
}

function createSprite(self, spriteId, spriteName, isFaceUp, frames) {
  var frame;
  if(isFaceUp)
    frame = frames[frames.indexOf(spriteName)];
  else
    frame = frames[frames.indexOf('back')];
  // Create sprite
  const sprite = self.add.sprite(0, 0, 'cards', frame);
  sprite.spriteId = spriteId;
  sprite.name = spriteName;
  sprite.displayWidth = 70;
  sprite.displayHeight = 95;
  sprite.isFaceUp = isFaceUp;

  return sprite;
}

// Updates all the sprites in an object stack with the parallax visual effect
function updateStackVisualEffect(self, object) {
  var pos = 0;
  var size = object.length-1;
  object.getAll().forEach(function (sprite) {
    stackVisualEffect(sprite, pos, size);
    pos++;
  });
}

// Makes a stack of cards look 3D
function stackVisualEffect(sprite, pos, size) {
  if(sprite) {
    sprite.x = -Math.floor((size-pos)/12);
    sprite.y = Math.floor((size-pos)/5);
  }
}

/*
// ************ BUGGY ****************
function flipObject(self, gameObject, frames) {
  self.socket.emit('objectFlip', { 
      objectId: gameObject.objectId
    });
  for(var i = 0; i < Math.floor(gameObject.length*0.5)+1; i++) {
    var firstSprite = gameObject.getAt(i);
    var secondSprite = gameObject.getAt(gameObject.length-1-i);

    var newSprite1 = createSprite(self, firstSprite.spriteId, firstSprite.name, !firstSprite.isFaceUp, frames);
    var newSprite2 = createSprite(self, secondSprite.spriteId, secondSprite.name, !secondSprite.isFaceUp, frames);
    gameObject.replace(firstSprite, newSprite2, true);
    gameObject.replace(secondSprite, newSprite1, true);
  }
}
*/

// Called when an object is dropped
function onObjectDrop(self, gameObject, frames) {
  // Find closest object to snap to
  var closest = findSnapObject(self, gameObject);
  if(closest) {
    // Move top card to bottom card's position
    gameObject.x = closest.x;
    gameObject.y = closest.y;

    // Tell server to merge the two stacks
    self.socket.emit('mergeStacks', { 
      topStack: gameObject.objectId,
      bottomStack: closest.objectId
    });
    self.socket.emit('objectInput', { 
      objectId: closest.objectId,
      x: closest.x, 
      y: closest.y 
    });

    // Locally merge
    const topSprites = gameObject.getAll();
    for(var i = 0; i < topSprites.length; i++) {
      var oldSprite = gameObject.getAt(i);
      // You have to create a new sprite. Adding the oldSprite crashes phaser.
      var newSprite = createSprite(self, oldSprite.spriteId, oldSprite.name, oldSprite.isFaceUp, frames);
      closest.add(newSprite); // Copy sprites to bottom stack
    }

    updateStackVisualEffect(self, closest);

    // Delete top stack
    gameObject.removeAll(true);
    gameObject.destroy();  
    
    
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
      distance = tempDistance;
      }
    }
  });
  return closestObj;
}

function dragGameObject(self, gameObject, dragX, dragY){
  if(gameObject) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;
    gameObject.depth = MENU_DEPTH-1;

    rotateObject(self, draggingObj);

    // Send the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  }
}

function rotateObject(self, gameObject) {
  var player = players[self.socket.id];
  if(gameObject.angle != -player.playerSpacing) {
    gameObject.angle = -player.playerSpacing;

    self.socket.emit('objectRotation', { 
      objectId: gameObject.objectId,
      angle: gameObject.angle
    });
  }
}

// Updates the global variable draggingObj
function drawTopSprite(self, frames){
  // Make sure you only draw once
  if(!drewAnObject) {
    self.socket.emit('drawTopSprite', {
      bottomStack: draggingObj.objectId
    });

    let drawnSpriteId = draggingObj.last.spriteId;
    draggingObj.remove(draggingObj.last, true);

    draggingObj = addObject(self, [drawnSpriteId], draggingObj.x, draggingObj.y, [draggingObj.last.isFaceUp], frames);
    //rotateObject(self, draggingObj);
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
