
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

// List of all the current players in the game 
var players = {};

const spriteIdToName = [];

// The id of an object being currently dragged. -1 if not
var isDragging = -1;

// This is made to keep track of updated items
// if not updated then the count should be off
// resets back to 0 when it gets to 100
var updatedCount = 0;

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

  // Not in use (implemented in lobby) Keep for reference
  //showNicknamePrompt(self);

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
  for (let i = 1; i <= 53; i++) {
    //let nextCard = frames[frames.indexOf(cardNames[i])];
    spriteIdToName[i] = cardNames[i]; // Info to find name from spriteId
    addObject(self, [i], frames);
  }

  /*
  // Add joker card
  var jokerFrame = frames[frames.indexOf("joker")];
  addObject(self, 53, 'joker', jokerFrame);
  */

  // for Thomas this doesnt work
  self.input.mouse.disableContextMenu();

  /*
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
  */

  // Only pick up the top object
  self.input.topOnly = true;

  // When the mouse starts dragging the object
  self.input.on('dragstart', function (pointer, gameObject) {
    //gameObject.setTint(0xff0000);
    isDragging = gameObject.objectId;
    // Tells the server to increase the object's depth and bring to front
    gameObject.depth = 999;
    self.socket.emit('objectDepth', { 
      objectId: gameObject.objectId
    });
  });
  
  // While the mouse is dragging
  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    // Locally changes the object's position
    gameObject.x = dragX;
    gameObject.y = dragY;

    // update to server on "objectInput"
    // This sends the input to the server
    self.socket.emit('objectInput', { 
      objectId: gameObject.objectId,
      x: dragX, 
      y: dragY 
    });
  });
  
  // When the mouse finishes dragging
  self.input.on('dragend', function (pointer, gameObject) {
    //gameObject.setTint(0x00ff00);
    //gameObject.clearTint();

    // Waits since there might be lag so last few inputs that the
    // player sends to the server before they put the card down
    // would move the cards
    self.time.delayedCall(500, function() {
      isDragging = -1;
    });

    onObjectDrop(self, gameObject);
  });  

  // Start the object listener for commands from server
  self.socket.on('objectUpdates', function (objectsInfo) {
    
    var allTableObjects = self.tableObjects.getChildren();
    // this keeps track of what items are updated
    updatedCount = (updatedCount + 1) % 100;
    Object.keys(objectsInfo).forEach(function (id) {
      self.tableObjects.getChildren().forEach(function (tableObject) {
        if(tableObject.objectId == id)
          updateObject(self, objectsInfo, id, tableObject, frames);
      });
      
    });
    // check for objects that weren't updated, then delete them
    self.tableObjects.getChildren().forEach(function (object) {
      // if objects dont have the updated count then they got deleted on the server
      if(updatedCount != object.updated) {
        //self.tableObjects.remove(object, true, true);
        object.removeAll(true);
        object.destroy();
      }
    });
  });
}

function updateObject(self, objectsInfo, id, object, frames) {
  if(!object && objectsInfo[id] != null) { // No local object
    // Create a new object
    addObject(self, objectsInfo[id].items, frames);
  } else if(objectsInfo[id] != null) {
    //console.log(objectsInfo[id].items.toString());

    object.updated = updatedCount;
    // Check if it is not being currently dragged and it's not in the same position
    if(isDragging != object.objectId && 
      (object.x != objectsInfo[id].x || object.y != objectsInfo[id].y) ) {
      // Update position
      object.setPosition(objectsInfo[id].x, objectsInfo[id].y);
    }
    // Update depth
    if(object.depth != objectsInfo[id].objectDepth)
      object.depth = objectsInfo[id].objectDepth;

    // Udpate sprite list
    var serverSpriteId = objectsInfo[id].items; // array of spriteId
    var localSprites = object.getAll();   // array of sprites gameobjects
    var i;
    for (i = 0; i < serverSpriteId.length; i++) {
      var id = serverSpriteId[i];
      if(i >= localSprites.length) {   // There are more server sprites than local
        // Create a new sprite
        var newSprite = self.add.sprite(0, 0, 'cards', frames[id]);
        newSprite.name = spriteIdToName[id];
        newSprite.spriteId = id;
        newSprite.displayWidth = 70;
        newSprite.displayHeight = 95;
        newSprite.isFaceUp = true;
        object.addAt(newSprite, i);
      } 
      else if(localSprites[i].spriteId != id) {
        localSprites[i].spriteId = id;
        localSprites[i].name = spriteIdToName[id];
        localSprites[i].setFrame(frames[spriteIdToName[id]]);
        localSprites[i].isFaceUp = true;
      }
    }
    localSprites.splice(i, localSprites.length); // Delete all the extra sprites
    
    /*
    if(objectsInfo[id].isFaceUp) { // server says face up
      // check if the card not up
      if(object.frame.name != frames[frames.indexOf(object.name)]) {
        object.setFrame(frames[frames.indexOf(object.name)]);
      }
    } else { // face down
      // check if the card is not down
      if(object.frame.name != "back") {
        object.setFrame(frames[frames.indexOf("back")]);
      }
    }
    */
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

/*
// At the start of the game it asks the player to enter a nickname
function showNicknamePrompt(self) {
  var text = self.add.text(self.cameras.main.centerX-150, self.cameras.main.centerY-100, 
    'Please enter a nickname:', { 
      color: 'Black', 
      boundsAlignH: 'center',
      fontFamily: 'Arial', 
      fontSize: '32px '
  });
  text.depth = 1000;
  var element = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('nameform');
  element.setPerspective(800);
  element.addListener('click');

  $('#nickname-form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    var inputNickname = $('#nickname').val();
    $('#nickname').val('');
    if(inputNickname !== '') {
      // Fade Out
      self.tweens.add({
        targets: element,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: function() {
          element.setVisible(false);
          element.destroy();
        }
      }, this);
      playerNickname = inputNickname;
      //  Populate the text with whatever they typed in as the username
      text.destroy();
      // Send to server
      self.socket.emit('playerNickname', playerNickname);
    } else {
      //  Flash the prompt
      self.tweens.add({ targets: text, alpha: 0.1, duration: 200, ease: 'Power3', yoyo: true });
    }
    return false;
  });
}
*/

// May have multiple sprites for an object (in the case of a stack)
function addObject(self, spriteIds, frames) {
  var i;
  var spritesToAdd = [];
  var spriteId;
  // first spriteId will always equal the objectId
  for(i = 0; i < spriteIds.length; i++) {
    spriteId = spriteIds[i];
    var spriteName = spriteIdToName[spriteId];
    var frame = frames[frames.indexOf(spriteName)];
    // Create sprite
    // No physics for client side
    spritesToAdd[i] = self.add.sprite(0, 0, 'cards', frame);

    // Assign the individual sprite an id and name and size
    spritesToAdd[i].spriteId = spriteId;
    spritesToAdd[i].name = spriteName;
    spritesToAdd[i].displayWidth = 70;
    spritesToAdd[i].displayHeight = 95;
    spritesToAdd[i].isFaceUp = true;
  }

  // Create object that acts like a stack (can have multiple sprites in it) 
  const object = self.add.container(0,0, spritesToAdd);
  object.objectId = spriteId;
  object.setSize(70, 95);
  object.setInteractive(); // Make interactive with mouse
  object.updated = updatedCount;
  self.input.setDraggable(object);
  // Change color on hover
  //object.on('pointerover', function () { this.setTint(0x00ff00); });
  //object.on('pointerout', function () {  this.clearTint(); });

  // Add it to the object group
  self.tableObjects.add(object);
}

// Called when an object is dropped
function onObjectDrop(self, gameObject) {
  // Find closest object
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



/*
function combineObjects(obj1, obj2) {

}
*/