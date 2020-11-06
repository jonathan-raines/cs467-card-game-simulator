
export function debugObjectContents(object) {
    console.log("Object #" + object.objectId + " contents ([0] is bottom/first):");
    
    var i = 0;

    object.getAll().forEach(function (sprite) {
      console.log("   [" + i + "]: " + cardNames[sprite.spriteId]);
      i++;
    });

}
  
export function debugTicker(self) {
    let tickInterval = setInterval(() => {

        var totalCards = 0;
        self.tableObjects.getChildren().forEach((object) => {
            totalCards += object.length;
    });

        console.log("--Total number of objects: " + totalCards);

    }, 10000); // 10 sec

}