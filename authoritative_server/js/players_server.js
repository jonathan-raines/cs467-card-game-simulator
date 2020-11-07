const customCursors = [
  {inUse: false, path: 'assets/customCursors/blue.png'},
  {inUse: false, path: 'assets/customCursors/green.png'},
  {inUse: false, path: 'assets/customCursors/orange.png'},
  {inUse: false, path: 'assets/customCursors/pink.png'},
  {inUse: false, path: 'assets/customCursors/purple.png'},
  {inUse: false, path: 'assets/customCursors/red.png'},
  {inUse: false, path: 'assets/customCursors/white.png'},
  {inUse: false, path: 'assets/customCursors/yellow.png'}
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
  deselectPlayerCursor(players[socket.id].path);
  
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

function deselectPlayerCursor(path){
  for (let i = 0; i < customCursors.length; i++) {
    if(customCursors[i].path == path){
      customCursors[i].inUse = false;
      break;
    }
  }
}