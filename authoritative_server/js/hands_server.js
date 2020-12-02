function moveObjectToHand(self, object, playerId, pos) {
  if(!object || !players[playerId]) {
    return;
  }
  //console.log("Moved " + cardNames[object.objectId] + " to " + players[playerId].name + "'s hand.");

  var numSprites = object.length; // Number of sprites in the object
  
  for(var i = 0; i < numSprites; i++) {
    var sprite = object.first;      // Get sprite object
    var isFaceUp = options["flipWhenEnterHand"] ? true : sprite.isFaceUp;
    // Update hand info for client
    players[playerId].hand.splice(pos, 0, sprite.spriteId);  
    players[playerId].isFaceUp.splice(pos, 0, isFaceUp);     
    //players[hand.playerId].isFaceUp.splice(pos, 0, true); // Always flip the card

    object.remove(sprite, true);    // Remove sprite from container
  }
  updateHandSpacing(playerId, -1);      // Adjust spacing

  delete objectInfoToSend[object.objectId]; // Delete object info for client
  object.active = false; // Save for later
}

// Go through all the cards in the hand and update the position
function updateHandSpacing(playerId, ignorePos, additionalPos) {
  if(!players[playerId]) {
    console.log("Cannot update hand spacing (playerId not found).");
    return;
  }

  if(ignorePos == null)
    ignorePos = -1;
  var rotation = Phaser.Math.DegToRad(-players[playerId].playerSpacing);
  var newLength = players[playerId].hand.length;
  var deltaLen = ignorePos == -1 ? newLength : newLength-1;
  if(additionalPos && additionalPos != -1) {
    newLength++;
    deltaLen++;
  }
  var startPos, spacing = HAND_SPACING, deltaPos = 0, deltaI = 0; 
  if(spacing * deltaLen >= HAND_WIDTH - 30)
    spacing = (HAND_WIDTH-CARD_WIDTH) / deltaLen;
  if(deltaLen % 2 == 1) // Even number of cards
    startPos = -spacing * Math.floor(deltaLen/2.0);
  else  // Odd number of cards
    startPos = -spacing * Math.floor(deltaLen/2.0) + spacing/2;

  for(var i = 0; i < newLength; i++) {
    // Compensate for rotation and translation
    var handX = players[playerId].x + Math.cos(rotation) * (startPos + spacing * (i+deltaPos));
    var handY = players[playerId].y + Math.sin(rotation) * (startPos + spacing * (i+deltaPos));
    
    if(additionalPos != null && i == additionalPos) {
      // Create a gap for a card to be added into
      var additionalXY = [handX, handY];
      deltaI--;
    }
    else {
      // Change card xy position
      players[playerId].handX[i+deltaI] = handX;
      players[playerId].handY[i+deltaI] = handY;
    }
    if(i == ignorePos) 
      deltaPos--; // Shift i for every card after ignorePos
  }
  if(additionalXY)
    return additionalXY; // Return the position of card to be inserted
  return null;
}

/*
// Get the position of cards not accounting for rotation and translation
function getHandSpacing(playerId, pos, length) {
  var rotation = Phaser.Math.DegToRad(-players[playerId].playerSpacing);
  var handXPos = players[playerId].x;
  var cardXPos = players[playerId].handX[pos];
  return (cardXPos - handXPos) / Math.cos(rotation);
}
*/


function takeFromHand(self, socket, playerId, objectId, x, y) {
  const player = players[playerId];
  if(!player) {
    console.log("Cannot take card from hand (playerId not found).");
    return;
  }
  // Locked hands (other players cant take cards from your hand)
  else if(options["lockedHands"] && (playerId != socket.id)) {
    return;
  }
  var isFaceUp = false;
  var pos = -1;
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;
      players[playerId].hand.splice(i, 1); // Remove from hand
      if(!options["flipWhenExitHand"])
        isFaceUp = players[playerId].isFaceUp[i];
      players[playerId].isFaceUp.splice(i, 1);
      break;
    }
  }
  if(pos == -1) {
    console.log("Cannot take " + cardNames[objectId] + " from " + player.name + "'s hand.");
    return;
  }
  updateHandSpacing(playerId, -1);      // Adjust spacing in hand

  //re-define the stack and put its sprite back into it
  const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
  const object = getTableObject(self, objectId); //find the original stack that the sprite was created with
  object.active = true;
  object.x = x;
  object.y = y;
  object.angle = -players[playerId].playerSpacing;
  object.objectId = objectId;
  object.add(sprite);

  //update clients telling them to create the new stack
  objectInfoToSend[object.objectId]={
    objectId: object.objectId,
    items: [ objectId ],
    isFaceUp: [ isFaceUp ],
    x: x,
    y: y,
    objectDepth: incOverallDepth(),
    angle: -players[playerId].playerSpacing
  }
  //console.log('Card ' + cardNames[objectId] + ' taken from ' + players[playerId].name + 'hand');
}



function flipHandObject(self, objectId, playerId) {
  var pos = -1;
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;
      players[playerId].isFaceUp[i] = !players[playerId].isFaceUp[i];
      break;
    }
  }
}

function setHandObjectPosition(self, socket, playerId, objectId, x, y) {
  if(!players[playerId]) {
    console.log("Cannot set card position in hand (playerId not found).");
    return;
  }
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId && (!options["lockedHands"] || (playerId == socket.id))) {
      var originalPos = i;
      players[playerId].handX[i] = x;
      players[playerId].handY[i] = y;
      break;
    }
  }
  var data = findPosToInsertInHand(objectId, x, y);

  if(data && data[0] == playerId && originalPos) {
    var pos = data[1];
    var newXY = updateHandSpacing(playerId, originalPos, pos);

    players[playerId].handX[i] = newXY[0];
    players[playerId].handY[i] = newXY[1];
  }
  else
    updateHandSpacing(playerId, originalPos); // Fan other cards in hand and ignore dragging card
}

function findPosToInsertInHand(objectId, x, y) {
  var closest = null;           // Object id of the closest card in a hand
  var dist = Math.pow(HAND_SNAP_DIST,2);
  var secondClosest = null;
  var dist2 = dist;

  Object.keys(players).forEach(key => {
    for(var i = 0; i < players[key].hand.length; i++) {
      var tempX = players[key].handX[i];
      var tempY = players[key].handY[i];
      var tempDistance = Math.pow(x-tempX,2) + Math.pow(y-tempY,2);

      if(players[key].hand[i] != objectId && tempDistance < dist) {
        secondClosest = closest;
        closest = {
          objectId: players[key].hand[i],
          playerId: key,
          pos: i,
          x: tempX,
          y: tempY
        };
        dist2 = dist;
        dist = tempDistance;
      }
      else if(players[key].hand[i] != objectId && tempDistance < dist2) {
        secondClosest = {
          objectId: players[key].hand[i],
          playerId: key,
          pos: i,
          x: tempX,
          y: tempY
        };
        dist2 = tempDistance;
      }
    }
  });
  
  if(closest) {
    var angle = Phaser.Math.DegToRad(-players[closest.playerId].playerSpacing);
    var isLeftOfClosest = Math.cos(angle) * (x-closest.x) + 
                          Math.sin(angle) * (y-closest.y) < 0;
  
    // Two handObjects are near
    if(secondClosest && closest.playerId == secondClosest.playerId) {
      var leftPos = Math.min(closest.pos, secondClosest.pos);
      var rightPos = Math.max(closest.pos, secondClosest.pos);
      var isLeftOfSecondClosest = Math.cos(angle) * (x-secondClosest.x) + 
                                  Math.sin(angle) * (y-secondClosest.y) < 0;
      
      if(isLeftOfClosest && isLeftOfSecondClosest) 
        return [closest.playerId, leftPos];        // Left of both cards
      else if(!isLeftOfClosest && !isLeftOfSecondClosest)
        return [closest.playerId, rightPos+1];     // Right of both cards
      else 
        return [closest.playerId, rightPos];       // Between the cards
    }
    else {  // Only one card thats near
      if(isLeftOfClosest)
        return [closest.playerId, closest.pos];    // Left of card
      else
        return [closest.playerId, closest.pos+1];  // Right of card
    }
  }
  return null;
}


function moveAroundInHand(self, playerId, objectId, newPos) {
  if(!players[playerId])
    return;
  if(newPos == -1) { // Reset spacing
    updateHandSpacing(playerId, -1);
    return;
  }
  var pos = -1; 
  for(var i = 0; i < players[playerId].hand.length; i++) {
    if(players[playerId].hand[i] == objectId) {
      pos = i;  // Current position of card
      break;  
    }
  }
  if(pos == -1) {
    console.log("Cannot move card around.");
    return;
  }
  else if(pos == newPos || pos + 1 == newPos) { // Same position dont do anything
    updateHandSpacing(playerId, -1);
    return;
  }
  else if(pos < 0)
    pos = 0;
  
  var x = players[playerId].handX[pos];
  var y = players[playerId].handY[pos];
  var isFaceUp = players[playerId].isFaceUp[pos];
  var toDelete = newPos > pos ? pos : pos+1;
  // Insert copy into new position
  players[playerId].hand.splice(newPos, 0, objectId); 
  players[playerId].handX.splice(newPos, 0, x);
  players[playerId].handY.splice(newPos, 0, y);
  players[playerId].isFaceUp.splice(newPos, 0, isFaceUp);

  // Remove original
  players[playerId].hand.splice(toDelete, 1); 
  players[playerId].handX.splice(toDelete, 1);
  players[playerId].handY.splice(toDelete, 1);
  players[playerId].isFaceUp.splice(toDelete, 1);

  updateHandSpacing(playerId, -1);
}

function removeAllFromHand(self, playerId) {
  var x = 90;
  var y = 0;
  const player = players[playerId];
  if(!player) {
    console.log("Cannot remove card from hand (playerId not found).");
    return;
  }
  for(var i = 0; i < players[playerId].hand.length; i++) {
    var objectId = players[playerId].hand[i];
    var isFaceUp = players[playerId].isFaceUp[i];

    //re-define the stack and put its sprite back into it
    const sprite = createSprite(self, objectId, cardNames[objectId], isFaceUp, frames);
    const object = getTableObject(self, objectId); //find the original stack that the sprite was created with
    object.active = true;
    object.x = x;
    object.y = y;
    object.angle = 0;
    object.objectId = objectId;
    object.add(sprite);

    //update clients telling them to create the new stack
    objectInfoToSend[object.objectId]={
      objectId: object.objectId,
      items: [ objectId ],
      isFaceUp: [ isFaceUp ],
      x: x,
      y: y,
      objectDepth: incOverallDepth(),
      angle: -players[playerId].playerSpacing
    }
    // Merge cards into one stack
    if(i == 0) 
      var discardStack = object;
    else if(discardStack) {
      let topStack = object;
      mergeStacks(topStack, discardStack);
    }
    x += 20;
  }
}