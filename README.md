# Online Multiplayer Card Game Simulator

This project runs online multiplayer game that users can join to play various playing card games. Rules are not enforced and it is up to the players to follow the rules.

## Services/ libraries used in the game

- [Phaser 3](https://phaser.io)
- [Ably Realtime](https://www.ably.io)
- [p2 NPM library](https://www.npmjs.com/package/p2)

# How to run this game

1. Create a free account with [Ably Realtime](https://www.ably.io) and obtain an API Key
2. Clone this repo locally
3. Navigate to the project folder and run `npm install` to install the dependencies
4. In the `server.js` file, update the `ABLY_API_KEY` variable with your own API Key, preferably via a .env file
5. Again in the `server.js` file, update `process.env.PORT` to use a port number of your choice directly or add a `PORT` variable in your .env file
6. To run the game use the command node --experimental-worker server.js

Please [reach out to me on Twitter](https://www.twitter.com/Srushtika) for any questions.
