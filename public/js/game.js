import { debugTicker } from './debug.js';
import { loadGameUI } from './gameUI.js';
import { isDragging } from './cards.js';

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

export var players = {};           // List of all the current players in the game 
// This player's info
export var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomName = '/' + getParameterByName('roomId');
// Main camera for this player and Keyboard input catcher
var cam, cursors;
// Create Phaser3 Game
var game = new Phaser.Game(config);

function preload() {
  this.load.html('menu', 'assets/menu.html');
  this.load.html('help', 'assets/help.html');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {

  var self = this;
  this.socket = io(roomName);

  this.tableObjects = this.add.group();

  cam = this.cameras.main;
  cam.setBackgroundColor('#3CB371');
  cam.setBounds(0, 0, game.config.width, game.config.height);

  if(playerNickname)
    self.socket.emit('playerNickname', playerNickname);
  
  debugTicker(self);

  loadGameUI(self);
  getPlayerUpdates(self); 

  cursors = self.input.keyboard.createCursorKeys();

  self.input.on('pointermove', function(pointer, currentlyOver) {
    if (pointer.leftButtonDown() && !currentlyOver[0] && isDragging == -1) {
      var camAngle = Phaser.Math.DegToRad(players[self.socket.id].playerSpacing); // in radians
      var deltaX = pointer.x - pointer.prevPosition.x;
      var deltaY = pointer.y-pointer.prevPosition.y;
      cam.scrollX -= (Math.cos(camAngle) * deltaX +
                      Math.sin(camAngle) * deltaY) / cam.zoom;
      cam.scrollY -= (Math.cos(camAngle) * deltaY -
                      Math.sin(camAngle) * deltaX) / cam.zoom;
    }
  });

  self.input.on('wheel', function(pointer, currentlyOver, deltaX, deltaY, deltaZ, event) { 
    if(cam.zoom + deltaY * -.0005 > 0)
      cam.zoom += deltaY * -.0005;
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

function getPlayerUpdates(self) {
  // Gets the list of current players from the server
  self.socket.on('currentPlayers', function (playersInfo) {
    players = playersInfo;
    cam.setAngle(players[self.socket.id].playerSpacing);
  });
}