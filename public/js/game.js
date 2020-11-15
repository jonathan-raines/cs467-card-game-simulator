import { debugTicker } from './debug.js';
import { loadGameUI } from './gameUI.js';
import { 
    isDragging,
    cardNames,
    MENU_DEPTH,
    options
 } from './cards.js';

 import {
    hands,
    addHand,
    updateHand
 } from './hands.js';

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
  this.load.image('blue', 'assets/customCursors/blue.png');
  this.load.image('green', 'assets/customCursors/green.png');
  this.load.image('orange', 'assets/customCursors/orange.png');
  this.load.image('pink', 'assets/customCursors/pink.png');
  this.load.image('purple', 'assets/customCursors/purple.png');
  this.load.image('red', 'assets/customCursors/red.png');
  this.load.image('white', 'assets/customCursors/white.png');
  this.load.image('yellow', 'assets/customCursors/yellow.png');
}

function create() {
  var self = this;
  this.socket = io(roomName);

  this.tableObjects = this.add.group();
  this.handObjects = this.add.group();
  this.handSnapZones = this.add.group();
  this.dummyCursors = this.add.group();

  cam = this.cameras.main;
  cam.setBackgroundColor('#3CB371');
  cam.setBounds(-game.config.width, -game.config.height, game.config.width*2, game.config.height*2);

  if(playerNickname)
    self.socket.emit('playerNickname', playerNickname);
  
  //debugTicker(self);

  loadGameUI(self);
  getPlayerUpdates(self); 

  cursors = self.input.keyboard.createCursorKeys();

  self.input.on('pointermove', function(pointer, currentlyOver) {
    if (pointer.leftButtonDown() && !currentlyOver[0] && isDragging == -1) {
      var camAngle = Phaser.Math.DegToRad(players[self.socket.id].playerSpacing); // in radians
      var deltaX = pointer.x - pointer.prevPosition.x;
      var deltaY = pointer.y - pointer.prevPosition.y;
      cam.scrollX -= (Math.cos(camAngle) * deltaX +
                      Math.sin(camAngle) * deltaY) / cam.zoom;
      cam.scrollY -= (Math.cos(camAngle) * deltaY -
                      Math.sin(camAngle) * deltaX) / cam.zoom;
      //console.log("x: " + pointer.x + " y: " + pointer.y);
    }
    //update server with pointer location
    if(players[self.socket.id]){
      let actualXY = cam.getWorldPoint(pointer.x, pointer.y)

      self.socket.emit('dummyCursorLocation', {
        playerId: players[self.socket.id].playerId,
        actualXY: actualXY
      });
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

// Gets the list of current players from the server
function getPlayerUpdates(self, frames) {

  self.socket.on('currentPlayers', function (playersInfo) {
    cam.setAngle(playersInfo[self.socket.id].playerSpacing);
    updatePlayers(self, playersInfo);
    players = playersInfo;
    updateCursors(self, players);
  });

  moveDummyCursors(self);
}

function updatePlayers(self, playersInfo) {
  Object.keys(playersInfo).forEach(function (id) {
    const hand = hands[id];
    if(hand == null && playersInfo[id] != null) {
      addHand(self, 
              id, 
              playersInfo[id].x, 
              playersInfo[id].y, 
              playersInfo[id].hand, 
              playersInfo[id].isFaceUp, 
              -playersInfo[id].playerSpacing);
    }
    else {
      updateHand(self,
                 id, 
                 playersInfo[id].x, 
                 playersInfo[id].y, 
                 playersInfo[id].hand, 
                 playersInfo[id].handX,
                 playersInfo[id].handY,
                 playersInfo[id].isFaceUp, 
                 -playersInfo[id].playerSpacing);
    } 
  });
  // Delete old hands
  Object.keys(hands).forEach(function (id) {
    if(playersInfo[id] == null) {
      console.log("deleting hand");
      hands[id].zone.destroy();
      delete hands[id];
    }
  });
  self.handObjects.getChildren().forEach(function (handObject) {
    //console.log("Card " + cardNames[handObject.objectId]);
    if(playersInfo[handObject.playerId] == null) {
      console.log("Removing card from hand =" + cardNames[handObject.objectId]);
      handObject.removeAll(true); 
      handObject.destroy();
    }
  });
  self.handSnapZones.getChildren().forEach(function (handSnapZone) {
    if(playersInfo[handSnapZone.playerId] == null) {
      handSnapZone.destroy();
    }
  });

}


function updateCursors(self, players){
  //set the player's cursor 
  let pointer = 'url(assets/customCursors/'+players[self.socket.id].playerCursor+'.png), pointer';
  self.input.setDefaultCursor(pointer);

  addNewDummyCursors(self, players);
  removeOldDummyCursors(self, players);
}

function addNewDummyCursors(self, players){
  //if multiple players
  if(Object.keys(players).length > 1){
    //for all current players, add or update a cursor
    Object.keys(players).forEach(function(player){
      let playerCursor = false;
      //don't add anything for local client
      if(players[player].playerId != self.socket.id){
        //see if cursor is already present
        self.dummyCursors.getChildren().forEach(function(dummyCursor){
          if(playerCursor.playerId == players[player].playerId){
            playerCursor = dummyCursor;
          }
        });
        //update existing cursors in case they have changed
        if(playerCursor){
          playerCursor.setTexture(player.playerCursor);
        }
        else{//create a new cursor
          //add cursor sprite
          playerCursor = self.add.sprite(-1000, -1000, players[player].playerCursor);
          playerCursor.playerId = players[player].playerId;
          playerCursor.depth = MENU_DEPTH;
          playerCursor.setOrigin(0,0); // Make the top left of sprite the point of rotation
          playerCursor.angle = -players[player].playerSpacing;
          //add playerCursor to a group for tracking
          self.dummyCursors.add(playerCursor);
        }
      }
    });
  }
}

function removeOldDummyCursors(self, players){
  //remove any cursors from the canvas if their player does not exist
  self.dummyCursors.getChildren().forEach(function(dummyCursor){
    let playerExists = false;
    Object.keys(players).forEach(function(player){
      if(dummyCursor.playerId == players[player].playerId){
        playerExists = true;
      }
    });
    if(!playerExists){
      self.dummyCursors.remove(dummyCursor, false, true);
    }
  });
}

function moveDummyCursors(self){
  //somehow update all of the cursors on each client
  self.socket.on('moveDummyCursors', function(cursorUpdateInfo){
    Object.keys(cursorUpdateInfo).forEach(function(curCursor){
      //console.log(cursorUpdateInfo)
      if(curCursor.playerId != players[self.socket.id].playerId){
        self.dummyCursors.getChildren().forEach(function(dummyCursor){
          if(dummyCursor.playerId == cursorUpdateInfo[curCursor].playerId){
            dummyCursor.x = cursorUpdateInfo[curCursor].actualXY.x 
            dummyCursor.y = cursorUpdateInfo[curCursor].actualXY.y
          }
        });
      }
    });
  });
}