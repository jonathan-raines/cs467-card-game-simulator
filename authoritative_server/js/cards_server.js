
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

  const xStart = 100,  yStart = 100, 
        xSpacing = 35, ySpacing = 200, 
        perRow = 13,   initialIsFaceUp = true;

  //add 52 playing cards in order
  for (let objectId = 1; objectId <= 52; objectId++) {
    overallDepth++;
    var initialX = ((objectId-1)%perRow) * xSpacing + xStart;
    var initialY = Math.floor((objectId-1)/perRow) * ySpacing + yStart;
    // Assigns the info to send to clients
    objectInfoToSend[objectId] = {
      objectId: objectId,
      items: [objectId], // Items in the stack, initially just the spriteId for the card
      isFaceUp: [initialIsFaceUp],
      x: initialX,
      y: initialY,
      objectDepth: overallDepth,
      rotation: 0
    };
    addObject(self, [objectId], initialX, initialY, [initialIsFaceUp], frames);
  }
  gatherAllCards(self, 400, 400);
}

function getTableObject(self, objectId) {
  // Finds the object by id
  // tableObjects.getChildren() is based of when the sprites were addded
  // to the group (here it is one off)
  return self.tableObjects.getChildren()[objectId-1];
}

function gatherAllCards(self, xPos, yPos) {
  const bottomStack = getTableObject(self, 1);
  for(let i = 2; i <= 52; i++) {
    let topStack = getTableObject(self, i);
    mergeStacks(topStack, bottomStack);
  }
  bottomStack.x = xPos;
  bottomStack.y = yPos;
}

function mergeStacks(topStack, bottomStack) {
  if(objectInfoToSend[topStack.objectId] == null) 
    console.log("Cannnot merge: topStack is null");
  else if(objectInfoToSend[bottomStack.objectId] == null) 
    console.log("Cannnot merge: bottomStack is null");
  else {
    // Take all items in top stack and put in bottom stack
    const topSprites = topStack.getAll();
    for(var i = 0; i < topSprites.length; i++) {
      bottomStack.add(topSprites[i]); // Copy sprites to bottom stack
      // Copy object info
      objectInfoToSend[bottomStack.objectId].items.push(topSprites[i].spriteId);
      objectInfoToSend[bottomStack.objectId].isFaceUp.push(objectInfoToSend[topStack.objectId].isFaceUp[i]);
    }
    //debugObjectContents(bottomStack);

    // Delete top stack info and set object to not active
    topStack.active = false;                    // Keep for later use
    delete objectInfoToSend[topStack.objectId];
  }
}

/*
// ************ BUGGY ***********************
function flipObject(self, gameObject, frames) {
  if(gameObject) {
    for(var i = 0; i < Math.floor(gameObject.length*0.5)+1; i++) {
      var firstSprite = gameObject.getAt(i);
      var secondSprite = gameObject.getAt(gameObject.length-1-i);

      var newSprite1 = createSprite(self, firstSprite.spriteId, firstSprite.name, !firstSprite.isFaceUp, frames);
      var newSprite2 = createSprite(self, secondSprite.spriteId, secondSprite.name, !secondSprite.isFaceUp, frames);
      gameObject.replace(firstSprite, newSprite2, true);
      gameObject.replace(secondSprite, newSprite1, true);
      objectInfoToSend[gameObject.objectId].items[i] = secondSprite.objectId;
      objectInfoToSend[gameObject.objectId].items[gameObject.length-1-i] = firstSprite.objectId;
      objectInfoToSend[gameObject.objectId].isFaceUp[i] = !secondSprite.isFaceUp;
      objectInfoToSend[gameObject.objectId].isFaceUp[gameObject.length-1-i] = !firstSprite.isFaceUp;
    }
  }
}
*/

function drawTopSprite(self, bottomStack) {
  const topSprite = bottomStack.last;                        //select the top sprite in the stack
  const topStack = getTableObject(self, topSprite.spriteId); //find the original stack that the sprite was created with
  
  //re-define the stack and put its original sprite back into it
  topStack.active = true;
  topStack.x = bottomStack.x;
  topStack.y = bottomStack.y;
  topStack.objectId = topSprite.spriteId;
  bottomStack.remove(topSprite);
  topStack.add(topSprite);
  
  console.log('bottom local contains: ');
  debugObjectContents(bottomStack);
  console.log('top local contains: ');
  debugObjectContents(topStack);
  
  //update clients telling them to create the new stack
  objectInfoToSend[topStack.objectId]={
    objectId: topStack.objectId,
    items: [ objectInfoToSend[bottomStack.objectId].items.pop() ],
    x: bottomStack.x,
    y: bottomStack.y,
    objectDepth: overallDepth,
    isFaceUp: [ objectInfoToSend[bottomStack.objectId].isFaceUp.pop() ]
  }
}

function addObject(self, spriteIds, x, y, spriteOrientations, frames) {
  const spritesToAdd = [];
  for(let i = 0; i < spriteIds.length; i++) {
    var spriteId = spriteIds[i];
    spritesToAdd[i] = createSprite(self, spriteId, cardNames[spriteId], spriteOrientations[i], frames);
  }

  // Create object that acts like a stack (can have multiple sprites in it) 
  const object = self.add.container(x, y, spritesToAdd);
  object.objectId = spriteIds[0]; // First spriteId is always objectId
  object.setSize(70, 95);
  object.active = true;

  self.tableObjects.add(object);  // Add it to the object group
}

// **This might not be needed. We could just keep track of sprite ids in objectInfoToSend
function createSprite(self, spriteId, spriteName, isFaceUp, frames) {
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