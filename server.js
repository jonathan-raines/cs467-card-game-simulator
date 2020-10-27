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
// URL for the database given in .env file from heroku
const CONNECTION_STRING = process.env.DATABASE_URL || '';
// The server running on a local machine if no .env database url
const IS_LOCAL = CONNECTION_STRING == '';
// Length of time the server will wait to close after making the room
const SERVER_TIMEOUT = 86400000; // 24 hrs

// Info to send to the games about the room
const activeGameRooms = {};

let pool;
if(!IS_LOCAL) {
  // Setting up the postgres database
  pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000
  });
} 

initializeDatabase();

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {  
  let requestedRoom = req.query.roomId || '';

  if(!IS_LOCAL) {
    // Update activeGameRooms from database
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
    })().catch( e => { console.error(e) })
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

  createRoom(newRoomId, 8).catch( e => { console.error(e) });

  // Make query to send gameroom info with URL
  const query = querystring.stringify({
      "roomId": newRoomId
  });
  res.redirect('/?' + query + nickname);
});


server.listen(port, function () {
  console.log(`Listening on ${server.address().port}`);
});

// You must catch this async function for example: createRoom(**,**)).catch( e => { console.error(e) });
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

// You must catch this async function for example: deleteRoom(**).catch( e => { console.error(e) });
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
      
      // Pass objects to auth game.js
      dom.window.io = room_io;        // Pass the socket io namespace name
      dom.window.IS_LOCAL = IS_LOCAL; // Let game.js know if it's running locally
      dom.window.pool = pool;         // Pass the pool for the database
      dom.window.roomInfo = roomInfo; // Pass room info to the server instance
      dom.window.numPlayers = 0;
      console.log('Server ' + roomInfo.roomName + ' started.');

      // Simple shutdown timer so the server doesn't stay on forever
      var timer = setTimeout(function() {
        console.log('Server ' + roomInfo.roomName + ' stopped.');
        deleteRoom(roomInfo.roomName).catch( e => { console.error(e) });
        dom.window.close();
      }, SERVER_TIMEOUT); 
    }).catch((error) => { console.log(error.message); });
  } else {
    console.log('Cannot start server because there is no room info.');
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
    "CREATE TABLE rooms (" +
      "room_id serial PRIMARY KEY, "+
      "room_name VARCHAR (20) NOT NULL, "+
      "num_players INTEGER NOT NULL, "+
      "max_players INTEGER NOT NULL "+
    "); ";
    // Not using players table but maybe in the future
    //"CREATE TABLE players (player_id serial PRIMARY KEY, player_name VARCHAR (50) NOT NULL, player_color VARCHAR (20), room INTEGER REFERENCES rooms);"
  ;(async function() {
    if(!IS_LOCAL) {
      const client = await pool.connect()
      await client.query(query)
      client.release()
    }
  })().catch( e => { console.error(e) }).then(() => {
    // -----------  For testing  ------------------
    createRoom('testing', 8).catch( e => { console.error(e) });
    createRoom('testing2', 8).catch( e => { console.error(e) });
    //----------------------------------------------
  });
}