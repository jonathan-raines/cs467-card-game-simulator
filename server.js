const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const { Client } = require('pg');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const Datauri = require('datauri');
const querystring = require('querystring'); 

const datauri = new Datauri();
const { JSDOM } = jsdom;

let port = process.env.PORT || 8082;

// Length of time the server will wait to close after making the room
const ROOM_TIMEOUT_LENGTH = 30 * 1000;
// How often the server will check if there are any players
const CHECK_ROOM_INTERVAL = 10 * 1000;

// Info to send to the games about the room
// roomName - the room code
// maxPlayers - the maximum number of players allowed
const activeGameRooms = {};

initializeDatabase();

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

// -----------  For testing  ------------------
activeGameRooms['testing'] = {
  roomName: 'testing',
  maxPlayers: 6
};
activeGameRooms['testing2'] = {
  roomName: 'testing2',
  maxPlayers: 6
};

setupAuthoritativePhaser(activeGameRooms['testing']);
setupAuthoritativePhaser(activeGameRooms['testing2']);

server.listen(port, function () {
  console.log(`Listening on ${server.address().port}`);
});

// Starts a new gameServer
function setupAuthoritativePhaser(roomInfo) {
  if(roomInfo && roomInfo.roomName) {
    // Add to the room's socket io namespace
    let room_io = io.of('/' + roomInfo.roomName);

    
    // Add the room to the database
    // Setting up the postgres database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    client.connect();
    var query = 
      "INSERT INTO rooms (room_name, num_players, max_players) VALUES ('" + roomInfo.roomName + "', 0, " + roomInfo.maxPlayers + ");";
    client.query(query, (err, res) => {
      if (err) throw err;
      for (let row of res.rows) {
        console.log('Rooms in database:');
        console.log(JSON.stringify(row));
      }
      client.end();
    });
    

    const domdom = JSDOM.fromFile(path.join(__dirname, 'authoritative_server/index.html'), {
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
      // Assign the socket io namespace
      dom.window.io = room_io;
      // Pass room info to the server instance
      dom.window.roomInfo = roomInfo;
      console.log('Server ' + roomInfo.roomName + ' started.');

      // Simple shutdown timer
      var timer = setTimeout(function() {
        window.close();
      }, 24*60*60*1000); //24 hrs


      /*
      var players, numPlayers = dom.window.numPlayers;
      room_io.on('currentPlayers', function(playersInfo) {
        players = playersInfo;
        numPlayers = Object.size(players);
        console.log('Num players = ' + numPlayers);
      }); 
      
      // Timer to close server if unactive
      var timer = setInterval(function() {
        // Check how many players
        //numPlayers = Object.size(players); 
        numPlayers = dom.window.numPlayers;
        console.log('Num players = ' + numPlayers);
        if(numPlayers <= 0) {
          // Wait
          setTimeout(function() { 
            // Check again and see if still no players
            //numPlayers = Object.size(players);
            numPlayers = dom.window.numPlayers;
            console.log('Num players = ' + numPlayers);
            if(numPlayers <= 0) {
              clearInterval(timer);
              dom.window.close(); 
              room_io.removeAllListeners('currentPlayers');
              console.log('Server ' + roomInfo.roomName + ' stopped.');
            }
          }, ROOM_TIMEOUT_LENGTH);
        }
      }, CHECK_ROOM_INTERVAL);
      */


    }).catch((error) => {
      console.log(error.message);
    });
  } else {
    console.log('Cannot start server because of no room info');
  }
}

Object.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
  }
  return size;
};


// create a uniqueId to assign to clients on auth
const uniqueId = function () {
  return Math.random().toString(36).substr(4);
};


function initializeDatabase() {
  // Setting up the postgres database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  client.connect();

  var query = ""+
    "DROP TABLE IF EXISTS players; "+
    "DROP TABLE IF EXISTS rooms; "+
    "CREATE TABLE rooms (room_id serial PRIMARY KEY, room_name VARCHAR (20) NOT NULL, num_players INTEGER NOT NULL, max_players INTEGER NOT NULL ); " +
    "CREATE TABLE players (player_id serial PRIMARY KEY, player_name VARCHAR (50) NOT NULL, player_color VARCHAR (20), room INTEGER REFERENCES rooms); " +
    "INSERT INTO rooms ("+
      "room_name, " +
      "num_players, "+
      "max_players"+
    ") VALUES ("+
      "'testing--', "+
      "0, "+
      "6"+
    ");";
  client.query(
    query, (err, res) => {
    if (err) throw err;
    client.end();
  });
}
