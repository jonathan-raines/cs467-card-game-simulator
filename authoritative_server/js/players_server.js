  
const customCursors = [
  {inUse: false, path: 'blue'},
  {inUse: false, path: 'green'},
  {inUse: false, path: 'orange'},
  {inUse: false, path: 'pink'},
  {inUse: false, path: 'purple'},
  {inUse: false, path: 'red'},
  {inUse: false, path: 'white'},
  {inUse: false, path: 'yellow'}
];

function addPlayer(self, socket) {
  numPlayers++;
  playerCounter++;
  players[socket.id] = {
    playerId: socket.id,
    name: "player" + playerCounter,
    playerNum: playerCounter,       // player's number that's not long
    hand: [],                    // All the ids of the cards in the hand
    handX: [],
    handY: [],                   // location of the cards in the hand
    isFaceUp: [],
    depth: -1,                   // objectId of the ONE object being currently dragged (-1 if not)
    x: TABLE_CENTER_X,
    y: TABLE_CENTER_Y,
    playerSpacing: 0,
    playerCursor: selectPlayerCursor()
  }
  //updatePlayerSpacing();         // Need to recalculate player spacing when a new user joins

  console.log('[Room ' +  roomName + '] ' +
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') connected');
}

function removePlayer(self, socket) {
  numPlayers--;
  removeAllFromHand(self, socket.id);
  deselectPlayerCursor(players[socket.id].playerCursor);
  
  console.log('[Room ' +  roomName + '] '+
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') disconnected');
  delete players[socket.id];

  updatePlayerSpacing();          // Need to recalculate player spacing when a user leaves
}

function updatePlayerSpacing() {
  var count = 0;
  for (x in players) {
    var angle = (count) * 360/numPlayers;
    count++;
    players[x].playerSpacing = angle;
    players[x].x = TABLE_CENTER_X + DISTANCE_FROM_CENTER * Math.sin(Phaser.Math.DegToRad(angle));
    players[x].y = TABLE_CENTER_Y + DISTANCE_FROM_CENTER * Math.cos(Phaser.Math.DegToRad(angle));
    updateHandSpacing(x, -1);
  }
}

function selectPlayerCursor(){
  let playerCursor = null;
  for (let i = 0; i < customCursors.length; i++) {
    if(!customCursors[i].inUse){
      playerCursor = customCursors[i];
      customCursors[i].inUse = true;
      break;
    }
  }
  return playerCursor.path;
}

function deselectPlayerCursor(playerCursor){
  for (let i = 0; i < customCursors.length; i++) {
    if(customCursors[i].path == playerCursor){
      customCursors[i].inUse = false;
      break;
    }
  }
}