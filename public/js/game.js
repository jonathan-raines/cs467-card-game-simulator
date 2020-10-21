
var config = {
  type: Phaser.AUTO,
  parent: 'game-area',
  dom: {
    createContainer: true
  },
  // Initial dimensions based on window size
  width: window.innerWidth*.8,
  height: window.innerHeight,
  backgroundColor: '#3CB371',
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// The id of an object being currently dragged. -1 if not
var isDragging = -1;

var game = new Phaser.Game(config);

function preload() {
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  var self = this;
  this.socket = io();
  this.tableObjects = this.add.group();

  this.menuLabel = this.add.text(20, 10, 'Menu', { 
    font: 'bold 34px Arial', 
    fill: '#fff', 
    align: 'left',
  }).setInteractive();

  loadCards(self);
  
  this.menuLabel.on('pointerdown', function() {
    if (this.text === 'Menu') {
      this.setText('Testing');
    } else {
      this.setText('Menu');
    }
  });
}

function update() {}


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
    // Tells the server to increase the object's depth and bring to front
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

    Object.keys(objectsInfo).forEach(function (id) {
      self.tableObjects.getChildren().forEach(function (object) {
        // Compares local players to auth server's players
        //   ▼ auth players          ▼ local players
        if (objectsInfo[id].objectId === object.objectId) {
          // Check if it is not being currently dragged
          if(isDragging != object.objectId) {
            // Updates position
            object.setPosition(objectsInfo[id].x, objectsInfo[id].y);
          }
          object.depth = objectsInfo[id].objectDepth;
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
          
        }
      });
    });
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
  object.on('pointerout', function () {
    this.clearTint();
  });
}


