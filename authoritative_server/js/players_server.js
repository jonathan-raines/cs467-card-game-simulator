function addPlayer(socket) {
  numPlayers++;

  players[socket.id] = {
    playerId: socket.id,
    name: "player" + numPlayers,
    playerNum: numPlayers,       // player's number that's not long
    playerSpacing: 0
  }
  updatePlayerSpacing();         // Need to recalculate player spacing when a new user joins
  console.log('[Room ' +  roomName + '] ' +
              'Player ' + players[socket.id].playerNum + 
              ' (' + players[socket.id].name + ') connected');
}

function removePlayer(socket) {
  numPlayers--;
  
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