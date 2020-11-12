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

function addPlayer(socket) {
  numPlayers++;

  players[socket.id] = {
    playerId: socket.id,
    name: "player" + numPlayers,
    playerNum: numPlayers,       // player's number that's not long
    playerSpacing: 0,
    playerCursor: selectPlayerCursor()
  }
  updatePlayerSpacing();         // Need to recalculate player spacing when a new user joins

  console.log('[Room ' +  roomName + '] ' +
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') connected');
}

function removePlayer(socket) {
  numPlayers--;
  deselectPlayerCursor(players[socket.id].playerCursor);
  
  console.log('[Room ' +  roomName + '] '+
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') disconnected');
  delete players[socket.id];
  updatePlayerSpacing();          // Need to recalculate player spacing when a user leaves
}

function updatePlayerSpacing() {
  for (x in players) {
    if (players[x].playerNum !== 1) {
      players[x].playerSpacing = (players[x].playerNum - 1) * 360/numPlayers;
    }
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