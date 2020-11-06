import { loadCards } from './cards.js';
import { playerNickname } from './game.js';

export function loadGameUI(self) {
  loadChat(self);
  loadHelp(self);
  loadMenu(self);
  loadCards(self);
}

function loadChat(self) {
  // Setup Chat
  $('#chat-form').submit(function(e) {
    e.preventDefault(); // prevents page reloading
    self.socket.emit('chat message', playerNickname + ': ' + $('#chat-msg').val());
    $('#chat-msg').val('');
    return false;
  });

  self.socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });
}

function loadHelp(self) {
  var help;

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

function loadMenu(self) {
    var menu;
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
}

