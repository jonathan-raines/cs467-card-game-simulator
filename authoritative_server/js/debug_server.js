function debugObjectContents(object) {
  console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
  var i = 0;
  const perRow = 4;
  var last;
  var string = "";
  object.getAll().forEach(function (sprite) {
    if(i % perRow != 0)
      string +=  ",   ";
    if(i < 10)
      string += "[" + i + "] :" + sprite.name;
    else
      string += "[" + i + "]:" + sprite.name;
    if(sprite.isFaceUp)
      string += "( up )";
    else
      string += "(down)"; 

    i++;
    if(i % perRow == 0) {
      console.log(string);
      string = "";
    }
  });
  console.log(string);
}

function debugTicker(self) {
  if(options["debugMode"]) {
    var tickRate = 15000;
    let tickInterval = setInterval(() => {
      var cardInfo = 0;
      Object.keys(objectInfoToSend).forEach(key => {
        if(objectInfoToSend[key]) {
          cardInfo += objectInfoToSend[key].items.length;
          //if(!objectInfoToSend[key].isFaceUp[0])
          //    console.log(cardNames[objectInfoToSend[key].objectId] + " is down");
        }
      });
      var serverCards = 0;
      self.tableObjects.getChildren().forEach(function (tableObject) {
        if(tableObject.active) {
          serverCards += tableObject.length;
        }
      });
      console.log("--Number of cards on server  : " + serverCards);
      console.log("  Number of objects on server: " + self.tableObjects.countActive());
      console.log("  Number of cards to client  : " + cardInfo);
      console.log("  Number of objects to client: " + Object.keys(objectInfoToSend).length);
      var string;

      Object.keys(players).forEach(key => {
        string = "  To client:" + players[key].name + " has ";
        for(var i = 0; i < players[key].hand.length; i++) {
          string += cardNames[players[key].hand[i]];
          if(players[key].isFaceUp[i])
            string += "▲, ";
          else
            string += "▼, ";
        }
        console.log(string);
      });
    }, tickRate); // 10 sec
  }
}