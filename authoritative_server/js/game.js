const players = {};

const config = {
  type: Phaser.HEADLESS,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: {
        y: 0
      }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  autoFocus: false
};

function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  const self = this;
  this.players = this.physics.add.group();

  this.physics.add.collider(this.players);

  loadCards(self);

  io.on('connection', function (socket) {
    console.log('a user connected');
    // create a new player and add it to our players object
    players[socket.id] = {
      x: Math.floor(Math.random() * 700) + 50,
      y: Math.floor(Math.random() * 500) + 50,
      playerId: socket.id,
    };
    // add player to server
    addPlayer(self, players[socket.id]);

    // send the players object to the new player
    socket.emit('currentPlayers', players);

    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('disconnect', function () {
      console.log('user disconnected');
      // remove player from server
      removePlayer(self, socket.id);
      // remove this player from our players object
      delete players[socket.id];
      // emit a message to all players to remove this player
      io.emit('disconnect', socket.id);
    });

    // when a player moves, update the player data
    socket.on('playerInput', function (inputData) {
      handlePlayerInput(self, socket.id, inputData);
    });
  });


}

function update() {
  this.players.getChildren().forEach((player) => {
    players[player.playerId].x = player.x;
    players[player.playerId].y = player.y;
    players[player.playerId].rotation = player.rotation;
  });
  this.physics.world.wrap(this.players, 5);
  io.emit('playerUpdates', players);
}

function randomPosition(max) {
  return Math.floor(Math.random() * max) + 50;
}

function handlePlayerInput(self, playerId, input) {
  self.players.getChildren().forEach((player) => {
    if (playerId === player.playerId) {
      players[player.playerId].input = input;
    }
  });
}

function addPlayer(self, playerInfo) {
  const player = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
  player.playerId = playerInfo.playerId;
  self.players.add(player);
}

function removePlayer(self, playerId) {
  self.players.getChildren().forEach((player) => {
    if (playerId === player.playerId) {
      player.destroy();
    }
  });
}

function loadCards(self) {
  let frames = self.textures.get('cards').getFrameNames();

  let x = 100;
  let y = 100;
  let cardNames = ['back', 
    'clubsAce', 'clubs2', 'clubs3', 'clubs4', 'clubs5', 'clubs6', 'clubs7', 'clubs8', 'clubs9', 'clubs10', 'clubsJack', 'clubsQueen', 'clubsKing',
    'diamondsAce', 'diamonds2', 'diamonds3', 'diamonds4', 'diamonds5', 'diamonds6', 'diamonds7','diamonds8', 'diamonds9', 'diamonds10', 'diamondsJack', 'diamondsQueen', 'diamondsKing',
    'heartsAce', 'hearts2', 'hearts3', 'hearts4', 'hearts5', 'hearts6', 'hearts7', 'hearts8', 'hearts9', 'hearts10', 'heartsJack', 'heartsQueen', 'heartsKing',
    'spadesAce', 'spades2', 'spades3', 'spades4', 'spades5', 'spades6', 'spades7', 'spades8', 'spades9', 'spades10', 'spadesJack', 'spadesQueen', 'spadesKing',
    'joker'
  ];

  //add 52 playing cards in order
  for (let i = 1; i <= 52; i++) {
    let nextCard = frames[frames.indexOf(cardNames[i])];
    let image = self.add.image(x, y, 'cards', nextCard).setInteractive();
    image.cardName = cardNames[i];
    self.input.setDraggable(image);

    x += 35;
    if (i % 13 == 0) {
      x = 100;
      y += 80;
    }
  }

  //display joker card
  x += 35;
  y += 80;
  nextCard = frames[frames.indexOf("joker")];
  image = self.add.image(x, y, 'cards', nextCard).setInteractive();
  image.cardName = "joker";

  self.input.setDraggable(image);

  self.input.mouse.disableContextMenu();

  self.input.on('pointerdown', function (pointer, targets) {
    if (pointer.rightButtonDown()) {
      if (targets[0].cardName == targets[0].frame.name) { //if target cardName == frame name, flip it to back
        targets[0].setFrame(frames[frames.indexOf("back")]);
      } else { //otherwise flip card to front
        targets[0].setFrame(frames[frames.indexOf(targets[0].cardName)]);
      }
    }
  });

  self.input.topOnly = true;

  self.input.on('drag', function (pointer, gameObject, dragX, dragY) {
    gameObject.x = dragX;
    gameObject.y = dragY;

  });
}

const game = new Phaser.Game(config);
window.gameLoaded();