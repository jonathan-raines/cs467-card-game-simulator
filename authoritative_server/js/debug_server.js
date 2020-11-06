function debugObjectContents(object) {
  console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
  var i = 0;
  const perRow = 5;
  var last;
  var string = "";
  object.getAll().forEach(function (sprite) {
    if(i % perRow != 0)
      string +=  ",		";
    if(i < 10)
      string += "[" + i + "] :" + sprite.name;
    else
      string += "[" + i + "]:" + sprite.name;
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

      var totalCards = 0;
      self.tableObjects.getChildren().forEach((object) => {
        totalCards += object.length;
      });

      console.log("--Total number of objects: " + totalCards);

  }, 10000); // 10 sec
}