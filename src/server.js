// Require the Bot class
const Bot = require('./bot');

// Instantiate 4 bots with unique names and websocket ports
const bot1 = new Bot('bot1', 8081);
const bot2 = new Bot('bot2', 8082);
const bot3 = new Bot('bot3', 8083);
const bot4 = new Bot('bot4', 8084);

console.log('All bots have been instantiated'); 