const WebSocket = require('ws');

class MineflayerBot {
  constructor(port) {
    this.port = port;
    this.wss = new WebSocket.Server({ port: this.port });
    this.setupWebsocket();
    console.log(`Mineflayer bot websocket server running on ws://localhost:${this.port}`);
  }

  setupWebsocket() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      ws.on('message', (message) => {
        console.log('Received: ' + message);
        ws.send('Echo: ' + message);
      });
    });
  }
}

const port = process.argv[2] || 8765;
const bot = new MineflayerBot(port); 