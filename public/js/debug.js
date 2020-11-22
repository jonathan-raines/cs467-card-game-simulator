import { 
  cardNames
} from './cards.js';

import { 
  hands
} from './hands.js';

import { 
  players
} from './game.js';

export function debugObjectContents(object) {
  console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
  
  var i = 0;

  object.getAll().forEach(function (sprite) {
    console.log("   [" + i + "]: " + cardNames[sprite.spriteId]);
    i++;
  });

}
  
export function debugTicker(self) {
  console.log("Debug Ticker Started");
  let tickInterval = setInterval(() => {

    var totalCards = 0;
    self.tableObjects.getChildren().forEach((object) => {
        totalCards += object.length;
    });

    console.log("--Total number of objects: " + totalCards);
    var string;
    /*
    Object.keys(hands).forEach(playerId => {
      string = "  In hands object id         :" + players[playerId].name + " has ";
      for(var i = 0; i < hands[playerId].cards.length; i++) {
        string += cardNames[hands[playerId].cards[i].objectId] + " ";
      }
      console.log(string);
    });
    Object.keys(hands).forEach(playerId => {
      string = "  In hands object 1st sprite :" + players[playerId].name + " has ";
      for(var i = 0; i < hands[playerId].cards.length; i++) {
        string += hands[playerId].cards[i].first.name + " ";
      }
      console.log(string);
    });
    */

    Object.keys(players).forEach(key => {
      string = "  In players object          :" + players[key].name + " has ";
      for(var i = 0; i < players[key].hand.length; i++) {
        string += cardNames[players[key].hand[i]] + " ";
      }
      console.log(string);
    });

  }, 10000); // 10 sec

}