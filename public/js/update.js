import { cardNames, players } from './game.js'
import { 
    addObject, 
    createSprite, 
    draggingObj, 
    isDragging, 
    MENU_DEPTH, 
    stackVisualEffect, 
    wasDragging 
} from './cards.js'

// Updates all the objects on the table
export function updateTableObjects(self, objectsInfo, frames) {
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

export function dragGameObject(self, gameObject, dragX, dragY){
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
  
      for (var i = 0; i < Math.max(object.length, serverSpriteIdArray.length); i++) {
  
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