const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const Datauri = require('datauri');
const querystring = require('querystring'); 

const datauri = new Datauri();
const { JSDOM } = jsdom;

// Info to send to the games about the room
// roomName - the room code
// maxPlayers - the maximum number of players allowed
const activeGameRooms = {};

// create a uniqueId to assign to clients on auth
const uniqueId = function () {
  return Math.random().toString(36).substr(4);
};

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {  
  let requestedRoom = req.query.roomId || '';
  // For regular requests to lobby
  if(requestedRoom == '') {
    res.sendFile(__dirname + '/views/lobby.html');
  // For specific rooms
  } else if (activeGameRooms[requestedRoom]) {
    var nickname = req.query.nickname || '';
    if(nickname != '') {
      const query = querystring.stringify({
        "nickname": nickname
      });
      res.sendFile(__dirname + '/views/index.html', query);
    } else
      res.sendFile(__dirname + '/views/index.html');
  // The gameroom is not active
  } else {
    res.send('No room found.'); // TEMP (should be a html link)
  }
});

app.get('/host-a-game', function(req, res) {
  // Make a new roomId
  var newRoomId = uniqueId();
  // Checks if we already have that room id
  while(activeGameRooms[newRoomId])
    newRoomId = uniqueId();

  let nickname = req.query.nickname || '';
  if(nickname != '')
    nickname = '&nickname=' + nickname;
  activeGameRooms[newRoomId] = {
    roomName: newRoomId,
    maxPlayers: 6
  };

  setupAuthoritativePhaser(activeGameRooms[newRoomId]);
  // Make query to send gameroom info
  const query = querystring.stringify({
      "roomId": newRoomId,
  });
  res.redirect('/?' + query + nickname);
});

function setupAuthoritativePhaser(roomInfo) {
  JSDOM.fromFile(path.join(__dirname, 'authoritative_server/index.html'), {
    // To run the scripts in the html file
    runScripts: "dangerously",
    // Also load supported external resources
    resources: "usable",
    // So requestAnimatinFrame events fire
    pretendToBeVisual: true
  }).then((dom) => {
    dom.window.URL.createObjectURL = (blob) => {
      if (blob){
        return datauri.format(blob.type, blob[Object.getOwnPropertySymbols(blob)[0]]._buffer).content;
      }
    };
    dom.window.URL.revokeObjectURL = (objectURL) => {};
    
    dom.window.io = io.of('/' + roomInfo.roomName);
    // Pass room info to the server instance
    dom.window.roomInfo = roomInfo;
  }).catch((error) => {
    console.log(error.message);
  });
  console.log('Server ' + roomInfo.roomName + ' started.');
}

// -----------  For testing  ------------------
activeGameRooms['testing'] = {
    roomName: 'testing',
    maxPlayers: 6
  };
setupAuthoritativePhaser(activeGameRooms['testing']);
//setupAuthoritativePhaser(activeGameRooms['testing2']);

let port = process.env.PORT || 8082;
server.listen(port, function () {
  console.log(`Listening on ${server.address().port}`);
});