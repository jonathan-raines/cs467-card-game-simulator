import { debugTicker } from './debug.js';
import { loadGameUI } from './gameUI.js';
import { isDragging } from './cards.js';
import { MENU_DEPTH } from './cards.js';

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

let cursorTimer = 0;

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
  this.dummyCursors = this.add.group();

  cam = this.cameras.main;
  cam.setBackgroundColor('#3CB371');

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
    //update server with pointer location
    if(players[self.socket.id] && cursorTimer >=4){
      let actualXY = cam.getWorldPoint(pointer.x, pointer.y)

      self.socket.emit('dummyCursorLocation', {
        playerNum: players[self.socket.id].playerNum,
        actualXY: actualXY
      });
      cursorTimer = 0;
    }
    else{
      cursorTimer++;
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
    updateCursors(self, players);
  });
}

function updateCursors(self, players){
  //set the player's cursor 
  let pointer = 'url(assets/customCursors/'+players[self.socket.id].playerCursor+'.png), pointer';
  self.input.setDefaultCursor(pointer);

  addNewDummyCursors(self, players);

  removeOldDummyCursors(self, players);

  moveDummyCursors(self);
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
          if(playerCursor.playerNum == players[player].playerNum){
            playerCursor = dummyCursor;
          }
        });
        //update existing cursors in case they have changed
        if(playerCursor){
          playerCursor.setTexture(player.playerCursor);
        }
        else{//create a new cursor
          //add cursor sprite
          playerCursor = self.add.sprite(players[player].playerNum*10, players[player].playerNum*10, players[player].playerCursor);
          playerCursor.playerNum = players[player].playerNum;
          playerCursor.setDepth(MENU_DEPTH+playerCursor.playerNum)
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
      if(dummyCursor.playerNum == players[player].playerNum){
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
      if(curCursor.playerNum != players[self.socket.id].playerNum){
        self.dummyCursors.getChildren().forEach(function(dummyCursor){
          if(dummyCursor.playerNum == cursorUpdateInfo[curCursor].playerNum){
            dummyCursor.x = cursorUpdateInfo[curCursor].actualXY.x 
            dummyCursor.y = cursorUpdateInfo[curCursor].actualXY.y
          }
        });
      }
    });
  });
}