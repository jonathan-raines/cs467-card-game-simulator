const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const { Pool } = require('pg');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const Datauri = require('datauri');
const querystring = require('querystring'); 

const datauri = new Datauri();
const { JSDOM } = jsdom;

let port = process.env.PORT || 8082;
// For local development use the -local argument after calling server.js
const IS_LOCAL = process.argv.slice(2)[0] == '-local';
// Length of time the server will wait to close after making the room
const SERVER_TIMEOUT = 24*60*60*1000; // 24 hrs

// Info to send to the games about the room
const activeGameRooms = {};

let pool;
if(!IS_LOCAL) {
  // Setting up the postgres database
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || '',
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000
  });
} 

initializeDatabase();

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {  
  let requestedRoom = req.query.roomId || '';

  if(!IS_LOCAL) {
    let query = "SELECT * FROM rooms WHERE room_name = '" + requestedRoom + "'";
    ;(async function() {
      const client = await pool.connect();
      await client.query(query, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }
        if(result.rows.length == 0)
           activeGameRooms[requestedRoom] = null;
        lobbyRouter(requestedRoom, req, res);
        client.release();
      });
    })()
  } else {
    lobbyRouter(requestedRoom, req, res);
  }
});


function lobbyRouter(requestedRoom, req, res) {
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
}


app.get('/host-a-game', function(req, res) {
  // Make a new roomId
  var newRoomId = uniqueId();
  // Checks if we already have that room id
  while(activeGameRooms[newRoomId])
    newRoomId = uniqueId();

  let nickname = req.query.nickname || '';
  if(nickname != '')
    nickname = '&nickname=' + nickname;

  createRoom(newRoomId, 8);

  // Make query to send gameroom info with URL
  const query = querystring.stringify({
      "roomId": newRoomId
  });
  res.redirect('/?' + query + nickname);
});


server.listen(port, function () {
  console.log(`Listening on ${server.address().port}`);
});


async function createRoom(roomId, maxPlayers) {
  activeGameRooms[roomId] = {
    roomName: roomId,
    maxPlayers: maxPlayers
  };
  roomInfo = activeGameRooms[roomId];
  setupAuthoritativePhaser(roomInfo);
  if(!IS_LOCAL) {
    var query = "INSERT INTO rooms (room_name, num_players, max_players) VALUES ('" + roomInfo.roomName + "', 0, " + roomInfo.maxPlayers + ");";
    const client = await pool.connect();
    await client.query(query);
    client.release();
  }
}

async function deleteRoom(roomId) {
  activeGameRooms[roomId] = null;
  if(!IS_LOCAL) {
    var query = "DELETE FROM rooms WHERE room_name = '" + roomId + "'";
    const client = await pool.connect();
    await client.query(query);
    client.release();
  }
}


// Starts a new gameServer
function setupAuthoritativePhaser(roomInfo) {
  if(roomInfo && roomInfo.roomName) {
    // Add to the room's socket io namespace
    let room_io = io.of('/' + roomInfo.roomName);
    // Run a JSDOM script for the server game engine
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
      
      dom.window.io = room_io;        // Pass the socket io namespace name
      dom.window.IS_LOCAL = IS_LOCAL;
      dom.window.roomInfo = roomInfo; // Pass room info to the server instance
      console.log('Server ' + roomInfo.roomName + ' started.');

      // Simple shutdown timer
      var timer = setTimeout(function() {
        console.log('Server ' + roomInfo.roomName + ' stopped.');
        deleteRoom(roomInfo.roomName);
        dom.window.close();
      }, 60*1000); //24 hrs
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
  var query = 
    "DROP TABLE IF EXISTS players; "+
    "DROP TABLE IF EXISTS rooms; "+
    "CREATE TABLE rooms (room_id serial PRIMARY KEY, room_name VARCHAR (20) NOT NULL, num_players INTEGER NOT NULL, max_players INTEGER NOT NULL ); " +
    "CREATE TABLE players (player_id serial PRIMARY KEY, player_name VARCHAR (50) NOT NULL, player_color VARCHAR (20), room INTEGER REFERENCES rooms);";

  ;(async function() {
    if(!IS_LOCAL) {
      const client = await pool.connect()
      await client.query(query)
      client.release()
    }
  })().then(() => {
    // -----------  For testing  ------------------
    createRoom('testing', 8);
    createRoom('testing2', 8);
    //----------------------------------------------
  });
}