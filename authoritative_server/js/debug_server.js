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
  let tickInterval = setInterval(() => {
    var cardInfo = 0;
    Object.keys(objectInfoToSend).forEach(key => {
      cardInfo += objectInfoToSend[key].items.length;
    });
    console.log("--Number of cards in server   : " + self.tableObjects.getChildren().length);
    console.log("  Number of objects in server : " + self.tableObjects.countActive());
    console.log("  Number of cards for client  : " + cardInfo);
    console.log("  Number of objects for client: " + Object.keys(objectInfoToSend).length);

  }, 10000); // 10 sec
}