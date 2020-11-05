export function loadMenu(self) {
    var menu, help;
    // jQuery to  interact with Menu HTML element
    $('#menu-button').click(function() {
      menu = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('menu');
  
      $('#user-name').val(playerNickname);
  
      $('#menu-form').submit(function(e) {
        e.preventDefault();
        var newColor = $('#background').val();
        if(newColor != self.backgroundColor) {
          self.backgroundColor = self.cameras.main.setBackgroundColor(newColor);
          self.socket.emit('backgroundColor', newColor);
        }
        newNickname = $('#user-name').val();
        if(playerNickname != newNickname) {
          playerNickname = newNickname;
          self.socket.emit('playerNickname', playerNickname);
        }
      });
  
      self.input.keyboard.on('keyup-ESC', function (event) {
        menu.destroy();
      });
  
      $('#exit-menu').click(function() {
        menu.destroy();
      });
    });
  
    // jQuery to intereact with Help HTML element
    $('#help-button').click(function() {
      help = self.add.dom(self.cameras.main.centerX, self.cameras.main.centerY).createFromCache('help');
  
      self.input.keyboard.on('keyup-ESC', function (event) {
        help.destroy();
      });
  
      $('#exit-help').click(function() {
        help.destroy();
      });
    });
  }