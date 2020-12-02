import { loadGameUI, playerRotation, seats, seatSelected } from './gameUI.js';
import { 
    isDragging,
    MENU_DEPTH,
    CARD_HEIGHT
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
  width: 1000,
  height: 1000,
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

export const TABLE_CENTER_X = 0;
export const TABLE_CENTER_Y = 0;
export const TABLE_EDGE_FROM_CENTER = 625 - CARD_HEIGHT/2; // Distance of the table edge from the center of the table
export const TABLE_EDGE_CONSTANT = ((2+Math.pow(2,.5))/(1+Math.pow(2,.5))) * TABLE_EDGE_FROM_CENTER;


export var players = {};           // List of all the current players in the game 
// This player's info
export var playerNickname = getParameterByName('nickname');
// Room's infrom from url query
const roomCode = '/' + getParameterByName('roomCode');
// Main camera for this player and Keyboard input catcher
export var cam;
var maxZoom;
var floor;
// Create Phaser3 Game
var game = new Phaser.Game(config);

function preload() {
  this.load.html('menu', 'assets/menu.html');
  this.load.html('help', 'assets/help.html');
  this.load.html('avatar', 'assets/playerBanner.html');
  this.load.image('floor', 'assets/DarkWood.jpg');
  this.load.image('tableTop', 'assets/cardTable.png');
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

  setCameraBounds(self);
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
      var scrollX = (Math.cos(camAngle) * deltaX +
                      Math.sin(camAngle) * deltaY) / cam.zoom;
      var scrollY = (Math.cos(camAngle) * deltaY -
                      Math.sin(camAngle) * deltaX) / cam.zoom;
      cam.scrollX -= scrollX;
      cam.scrollY -= scrollY;
      // Update floor scrolling
      floor.x = cam.scrollX + window.innerWidth/2.0;
      floor.y = cam.scrollY + window.innerHeight/2.0;
      floor.tilePositionX = cam.scrollX + window.innerWidth/2.0;
      floor.tilePositionY = cam.scrollY + window.innerHeight/2.0;
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
    if(newZoom > maxZoom && newZoom < 2) {
      cam.zoom = newZoom;
      //console.log("zoom:" + newZoom);
      self.dummyCursors.getChildren().forEach(function(dummyCursor){
        dummyCursor.scale = 0.5 / newZoom;
      });
    }
  });

  // Whenever the window is resized
  self.scale.on('resize', setCameraBounds, self);
}

function update() {}

export function setCameraBounds(self) {
  maxZoom = Math.min( window.innerHeight / (TABLE_EDGE_FROM_CENTER * 2 + 400), 
                      window.innerWidth / (TABLE_EDGE_FROM_CENTER * 2 / 0.8 + 400));
  cam.setZoom(maxZoom);
  cam.centerOn(0,0);
  var MaxXY = Math.min((TABLE_CENTER_X - TABLE_EDGE_FROM_CENTER - game.config.width*1.5), 
                       (TABLE_CENTER_Y - TABLE_EDGE_FROM_CENTER - game.config.height*1.5));
  cam.setBounds(MaxXY, MaxXY, -2*MaxXY, -2*MaxXY);              
  
  if(floor) {
    var camAngle = Phaser.Math.DegToRad(playerRotation); // in radians
    var floorSize = 200 + Math.max(
                      Math.abs((Math.cos(camAngle) * window.innerWidth  + Math.sin(camAngle) * window.innerHeight)) / cam.zoom,
                      Math.abs((Math.cos(camAngle) * window.innerHeight - Math.sin(camAngle) * window.innerWidth)) / cam.zoom
                    );
    floor.setSize(floorSize, floorSize);
    floor.x = 0;
    floor.y = 0;
    floor.tilePositionX = 0;
    floor.tilePositionY = 0;
  }
  
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
  let pointer = 'url(assets/customCursors/'+players[self.socket.id].playerCursor+'.cur), pointer';
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
          playerCursor.scale = 0.5 / cam.zoom;
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
  var maxFloor = Math.max(window.innerWidth / cam.zoom + 200, window.innerHeight / cam.zoom + 200) * 1.2;
  floor = self.add.tileSprite(-100,-100, maxFloor, maxFloor, 'floor');
  var tableTop = self.add.image(TABLE_CENTER_X, TABLE_CENTER_Y, 'tableTop');

}