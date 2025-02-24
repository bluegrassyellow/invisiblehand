const { registerBot } = require('./bots');
const Bot = require('./bot');

// **Create & Register Bots**
const bot1 = new Bot('bot1', 8081);
const bot2 = new Bot('bot2', 8082);
const bot3 = new Bot('bot3', 8083);
const bot4 = new Bot('bot4', 8084);

registerBot(bot1);
registerBot(bot2);
registerBot(bot3);
registerBot(bot4);

console.log('All bots have been instantiated');