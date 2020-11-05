import { loadMenu } from './menu.js';

import { 
  loadCards, 
  updateTableObjects, 
  addObject, 
  createSprite, 
  stackVisualEffect, 
  updateObject, 
  onObjectDrop,
  findSnapObject,
  dragGameObject,
  rotateObject,
  drawTopSprite,
  isDragging,
  wasDragging,
  draggingObj,
  drewAnObject,
  updateStackVisualEffect
} from './cards.js';

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

export const cardNames = ['back', 
  'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
  'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
  'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
  'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
  'joker'
];

export var players = {};           // List of all the current players in the game 
// This player's info
var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomName = '/' + getParameterByName('roomId');

var cam, cursors;

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
