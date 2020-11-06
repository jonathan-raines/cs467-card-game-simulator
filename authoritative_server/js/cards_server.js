
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

function flipObject(self, gameObject) {
  if(gameObject) {
    // Only one card (don't need to switch game objects)
    if(gameObject.length == 1) {
      gameObject.first.isFaceUp = !(gameObject.first.isFaceUp);
      objectInfoToSend[gameObject.objectId].isFaceUp[0] = gameObject.first.isFaceUp;
    }
    else {
      // Get the container for the last card which will be the first sprite of the new stack
      if(gameObject.last == null) {
        console.log("Cannot access gameObject sprite in flipObject()");
        return;
      }
      const newStack = getTableObject(self, gameObject.last.spriteId);
      newStack.active = true;
      newStack.objectId = gameObject.last.spriteId;
      newStack.x = gameObject.x;
      newStack.y = gameObject.y;

      var newSprites = [];  // For sprite ids to send to client
      var newIsFaceUp = []; // For card orientation to send to client
      const numSprites = gameObject.length;

      // Copy the sprites in reverse order
      for(var i = 0; i < numSprites; i++) {
        // Get sprite object
        var sprite = gameObject.last;         // Take last sprite first
        sprite.isFaceUp = !sprite.isFaceUp;   // Flip card
        newStack.add(sprite);

        // Remember info for client
        newSprites.push(sprite.spriteId);
        newIsFaceUp.push(sprite.isFaceUp);        
      }
      //debugObjectContents(newStack);
      overallDepth++;

      //update clients telling them to create the new stack
      objectInfoToSend[newStack.objectId] = {
        objectId: newStack.objectId,
        items: newSprites,
        x: gameObject.x,
        y: gameObject.y,
        objectDepth: overallDepth,
        isFaceUp: newIsFaceUp
      }
      //console.log("----Flipped obj len: " + gameObject.length);
      //console.log("----Newobj len:      " + newStack.length);
      delete objectInfoToSend[gameObject.objectId];
      gameObject.active = false;  // Save for later use
    }
  }
}

function drawTopSprite(self, bottomStack) {
  if(!bottomStack || !bottomStack.last) {
    console.log("Can't draw card");
    return;
  }
  const topSprite = bottomStack.last;                        //select the top sprite in the stack
  const topStack = getTableObject(self, topSprite.spriteId); //find the original stack that the sprite was created with
  
  //re-define the stack and put its original sprite back into it
  topStack.active = true;
  topStack.x = bottomStack.x;
  topStack.y = bottomStack.y;
  topStack.objectId = topSprite.spriteId;
  topStack.add(topSprite);
  /*
  console.log('bottom local contains: ');
  debugObjectContents(bottomStack);
  console.log('top local contains: ');
  debugObjectContents(topStack);
  */
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

function shuffleStack(self, originStack){
  // Can't shuffle a deck of 1
  if(originStack.length == 1)
    return;
  //shuffle the container
  originStack.shuffle();

  //find the new bottom sprite of the container
  const shuffledBottomSprite = originStack.first;

  if(!shuffledBottomSprite) {
    console.log("Cannot shuffle stack #" + originStack.objectId);
    return;
  }
  //find the original stack for the new bottom sprite
  const shuffledStack = getTableObject(self, shuffledBottomSprite.spriteId);

  //re-define the shuffledStack 
  shuffledStack.active = true;
  shuffledStack.x = originStack.x;
  shuffledStack.y = originStack.y;
  shuffledStack.rotation = originStack.rotation;
  shuffledStack.objectId = shuffledBottomSprite.spriteId;

  //put all of the old originStack sprites into shuffledStack
  const originSprites = originStack.getAll();
  let tempItems = [];
  let tempIsFaceUp = [];
  for(var i = 0; i < originSprites.length; i++) {
    shuffledStack.add(originSprites[i]);
    tempItems.push(originSprites[i].spriteId);
    tempIsFaceUp.push(originSprites[i].isFaceUp);
    
  }
  /*
  console.log('originalStack contains: ');
  debugObjectContents(originStack);
  console.log('shuffledStack contains: ');
  debugObjectContents(shuffledStack);
  */
  //update clients telling them about the new stack
  objectInfoToSend[shuffledStack.objectId] = {
    objectId: shuffledStack.objectId,
    items: tempItems,
    x: originStack.x,
    y: originStack.y,
    objectDepth: overallDepth,
    isFaceUp: tempIsFaceUp,
    rotation: shuffledStack.rotation
  }

  originStack.active = false;       // Keep for later use
  objectInfoToSend[originStack.objectId] = null; // Don't send to client
}
