import { debugTicker } from './debug.js';
import { loadGameUI, playerRotation, seats, seatSelected } from './gameUI.js';
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

export var config = {
  type: Phaser.AUTO,
  parent: 'game-area',
  dom: {
    createContainer: true
  },
  // Initial dimensions based on window size
  width: 1200,
  height: 1200,
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

const TABLE_DEFAULT_COLOR = 0x477148;
export const TABLE_CENTER_X = 0;
export const TABLE_CENTER_Y = 0;
export const TABLE_EDGE_FROM_CENTER = 600; // Distance of the table edge from the center of the table
export const TABLE_EDGE_CONSTANT = ((2+Math.pow(2,.5))/(1+Math.pow(2,.5))) * TABLE_EDGE_FROM_CENTER;


export var players = {};           // List of all the current players in the game 
// This player's info
export var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomCode = '/' + getParameterByName('roomCode');
// Main camera for this player and Keyboard input catcher
export var cam;
var maxZoom;
// Create Phaser3 Game
var game = new Phaser.Game(config);

function preload() {
  this.load.html('menu', 'assets/menu.html');
  this.load.html('help', 'assets/help.html');
  this.load.html('avatar', 'assets/playerBanner.html');
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
  this.socket = io(roomCode);

  this.tableObjects = this.add.group();
  this.handObjects = this.add.group();
  this.handSnapZones = this.add.group();
  this.dummyCursors = this.add.group();
  this.tableParts = this.add.group();

  cam = this.cameras.main;
  cam.setBackgroundColor('#654321');
  setCameraBounds();
  setupTable(self);
  
  self.socket.on('defaultName', function(name) {
    playerNickname = (!playerNickname) ? name : playerNickname;
  });

  //debugTicker(self);
  loadGameUI(self);
  getPlayerUpdates(self);

  self.input.on('pointermove', function(pointer, currentlyOver) {
    if (pointer.leftButtonDown() && !currentlyOver[0] && isDragging == -1) {
      var camAngle = Phaser.Math.DegToRad(playerRotation); // in radians
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
    var newZoom = cam.zoom + deltaY * -.0005;
    if(newZoom > maxZoom && newZoom < 2) 
      cam.zoom = newZoom;
  });

  // Whenever the window is resized
  self.scale.on('resize', setCameraBounds);
}

function update() {}

function setCameraBounds() {
  maxZoom = Math.min( window.innerHeight / (TABLE_EDGE_FROM_CENTER * 2 + 200), 
                      window.innerWidth / (TABLE_EDGE_FROM_CENTER * 2 / 0.8 + 200));
  cam.setZoom(maxZoom);
  cam.setBounds((TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER - game.config.width*.8), 
              (TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER - game.config.height*.8), 
              2*(TABLE_CENTER_X + TABLE_EDGE_FROM_CENTER + game.config.width*.8), 
              2*(TABLE_CENTER_Y + TABLE_EDGE_FROM_CENTER + game.config.height*.8),
              true);
}

// Gets url parameters/queries for a name and returns the value
export function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Gets the list of current players from the server
function getPlayerUpdates(self, frames) {
  self.socket.on('nameChange', function(playersInfo) {
    for (var x in playersInfo) {
      if (playersInfo[x].playerId == self.socket.id) {
        playerNickname = playersInfo[x].name;
      }
    }
  });

  self.socket.on('currentPlayers', function (playersInfo) {
    if (seatSelected == true) {   // don't create hand until player seat is known 
      updatePlayers(self, playersInfo);
      players = playersInfo;
      updateCursors(self, players);
    }
  });
  moveDummyCursors(self);
}

function updatePlayers(self, playersInfo) {
  Object.keys(playersInfo).forEach(function (id) {
      if(!(playersInfo[id].x == 0 && playersInfo[id].y == 0)) {
        const hand = hands[id];
        if(hand == null && playersInfo[id] != null) {
          addHand(self, 
                  id, 
                  playersInfo[id].x, 
                  playersInfo[id].y, 
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
      }
  });
  // Delete old hands
  Object.keys(hands).forEach(function (id) {
    if(playersInfo[id] == null) {
      delete hands[id];
    }
  });
  self.handObjects.getChildren().forEach(function (handObject) {
    if(playersInfo[handObject.playerId] == null) {
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
          if(dummyCursor.playerId == players[player].playerId){
            playerCursor = dummyCursor;
            //update existing cursors in case they have changed
            if(dummyCursor.texture.key != players[player].playerCursor){
              dummyCursor.setTexture(players[player].playerCursor);
            }
          }
        });
        if(!playerCursor){//create a new cursor
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
        playerExists= true;
        dummyCursor.angle = -players[player].playerSpacing;
      }
    });
    if (!playerExists){
      self.dummyCursors.remove(dummyCursor, false, true);
    }
  });
  //remove any duplicate cursors for each player
  Object.keys(players).forEach(function(player){
    let playerDummies = [];
    self.dummyCursors.getChildren().forEach(function(dummyCursor){
      if(players[player].playerId == dummyCursor.playerId){
        playerDummies.push(dummyCursor);
      }
    });
    for (let i = 1; i < playerDummies.length; i++) {
      self.dummyCursors.remove(playerDummies[i], false, true);
    }
  });
}

function moveDummyCursors(self){
  //somehow update all of the cursors on each client
  self.socket.on('moveDummyCursors', function(cursorUpdateInfo){
    Object.keys(cursorUpdateInfo).forEach(function(curCursor){
      if(players[self.socket.id] && curCursor.playerId != players[self.socket.id].playerId){
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

function setupTable(self) {
  var table1 = self.add.rectangle(TABLE_CENTER_X, TABLE_CENTER_Y, TABLE_EDGE_FROM_CENTER*2, TABLE_EDGE_FROM_CENTER*(2/(1+Math.pow(2,.5))), TABLE_DEFAULT_COLOR);
  var table2 = self.add.rectangle(TABLE_CENTER_X, TABLE_CENTER_Y, TABLE_EDGE_FROM_CENTER*2, TABLE_EDGE_FROM_CENTER*(2/(1+Math.pow(2,.5))), TABLE_DEFAULT_COLOR);
  var table3 = self.add.rectangle(TABLE_CENTER_X, TABLE_CENTER_Y, TABLE_EDGE_FROM_CENTER*2, TABLE_EDGE_FROM_CENTER*(2/(1+Math.pow(2,.5))), TABLE_DEFAULT_COLOR);
  var table4 = self.add.rectangle(TABLE_CENTER_X, TABLE_CENTER_Y, TABLE_EDGE_FROM_CENTER*2, TABLE_EDGE_FROM_CENTER*(2/(1+Math.pow(2,.5))), TABLE_DEFAULT_COLOR);
  table2.angle = 45;
  table3.angle = 90;
  table4.angle = 135;
  self.tableParts.add(table1);
  self.tableParts.add(table2);
  self.tableParts.add(table3);
  self.tableParts.add(table4);
}