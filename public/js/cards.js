import { players } from './game.js';
import { updateTableObjects } from './update.js'

const MENU_DEPTH = 1000;
const STACK_SNAP_DISTANCE = 40;
const LONG_PRESS_TIME = 300;

export const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

export var isDragging = -1;        // The id of an object being currently dragged. -1 if not
export var wasDragging = -1;       // Obj id that was recently dragged. For lag compensation.
var draggingObj = null;     // The pointer to the object being currently dragged
var drewAnObject = false;   // Keep track if you drew an item so you don't draw multiple

export function loadCards(self) {
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

// May have multiple sprites for an object (in the case of a stack)
export function addObject(self, spriteIds, x, y, spriteOrientations, frames) {
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

export function createSprite(self, spriteId, spriteName, isFaceUp, frames) {
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

// Makes a stack of cards look 3D
export function stackVisualEffect(sprite, pos, size) {
    if(sprite) {
      sprite.x = -Math.floor((size-pos)/12);
      sprite.y = Math.floor((size-pos)/5);
    }
}

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

// Updates all the sprites in an object stack with the parallax visual effect
function updateStackVisualEffect(self, object) {
    var pos = 0;
    var size = object.length-1;
    object.getAll().forEach(function (sprite) {
      stackVisualEffect(sprite, pos, size);
      pos++;
    });
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