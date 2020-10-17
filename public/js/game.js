
var config = {
  type: Phaser.AUTO,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  backgroundColor: '#3CB371',
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

var game = new Phaser.Game(config);

function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
}

function create() {
  var self = this;
  this.socket = io();
  this.players = this.add.group();

  loadCards(self);

  this.socket.on('currentPlayers', function (players) {
    Object.keys(players).forEach(function (id) {
      displayPlayers(self, players[id], 'ship');
    });
  });

  this.socket.on('newPlayer', function (playerInfo) {
    displayPlayers(self, playerInfo, 'ship');
  });

  this.socket.on('disconnect', function (playerId) {
    self.players.getChildren().forEach(function (player) {
      if (playerId === player.playerId) {
        player.destroy();
      }
    });
  });

  this.socket.on('playerUpdates', function (players) {
    Object.keys(players).forEach(function (id) {
      self.players.getChildren().forEach(function (player) {
        // Compares local players to auth server's players
        //   ▼ auth players          ▼ local players
        if (players[id].playerId === player.playerId) {
          // Updates rotation and position
          player.setPosition(players[id].x, players[id].y);
        }
      });
    });
  });
}

function update() {}

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

function displayPlayers(self, playerInfo, sprite) {
  const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5);
  player.playerId = playerInfo.playerId;
  self.players.add(player);
}