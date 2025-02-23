const mineflayer = require('mineflayer');
const WebSocket = require('ws');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const { goals } = require('mineflayer-pathfinder')

const mcData = require('minecraft-data');
const { Vec3 } = require('vec3');

class Bot {
  constructor(name, wsPort) {
    this.name = name;
    this.wsPort = wsPort;
    this.bot = mineflayer.createBot({
        host: 'localhost', // change if necessary
        port: 25565,       // default Minecraft server port
        username: name
    });

    this.bot.loadPlugin(pathfinder);
    this.bot.once('spawn', () => {
        console.log(`${this.name} has spawned in the Minecraft world!`);
        this.bot.chat("/gamemode survival")

        const data = mcData(this.bot.version);
        this.movements = new Movements(this.bot, data);
        this.movements.canDig = false;
        this.bot.pathfinder.setMovements(this.movements);
    });

    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.wsPort });
    console.log(`${this.name} WebSocket server started on port ${this.wsPort}`);
    
    this.wss.on('connection', ws => {
        console.log(`Client connected to ${this.name}'s WebSocket server`);
        ws.send('Hello from the bot!');
        ws.on('message', message => {
            console.log(`${this.name} received message: ${message}`);
            if (String(message).trim() === 'hunt') {
                console.log("here")
                this.hunt();
            } else if (String(message).trim() === 'aboveground') {
                this.ensureAboveGround();
            } else if (String(message).trim() === 'dig') {
                this.goUnderground();
            }
        });
    });
  }

  async hunt() {
    const foodAnimals = ['cow', 'pig', 'sheep', 'chicken', 'rabbit'];
    
    let target = this.bot.nearestEntity(entity => foodAnimals.includes(entity.name));
    if (!target) return "No food animals found nearby.";

    console.log(`${this.bot.username} engaging food target ${target.name} at ${target.position}`);

    try {
        const mcData = require('minecraft-data')(this.bot.version);
        const movements = new Movements(this.bot, mcData);
        movements.maxDropDown = 1;
        movements.allowParkour = false;
        this.bot.pathfinder.setMovements(movements);

        this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);

        const maxTime = 30000;
        const startTime = Date.now();
        let lastDistance = this.bot.entity.position.distanceTo(target.position);
        let stuckCount = 0;

        while (target.isValid && Date.now() - startTime < maxTime) {
            target = this.bot.nearestEntity(entity => foodAnimals.includes(entity.name));
            if (!target) break;

            let distance = this.bot.entity.position.distanceTo(target.position);

            if (distance < 3) {
                this.bot.setControlState('jump', false);
                console.log(`${this.bot.username} attacking ${target.name}`);
                this.bot.attack(target);
                await new Promise(resolve => setTimeout(resolve, 600));
            } else {
                if (distance >= lastDistance - 0.5) {
                    stuckCount++;
                    if (stuckCount >= 3) {
                        console.log(`${this.bot.username} seems stuck; trying to clear obstacles.`);
                        await this.clearObstacles();
                        console.log(`${this.bot.username} recalculating path to ${target.name}.`);
                        this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);
                        stuckCount = 0;
                        lastDistance = distance;
                    }
                } else {
                    stuckCount = 0;
                }
                lastDistance = distance;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.bot.pathfinder.stop();

        if (!target.isValid) {
            console.log(`${this.bot.username} defeated ${target.name}!`);
            return `Hunting for food (${target.name}) succeeded.`;
        } else if (Date.now() - startTime >= maxTime) {
            return `Failed to defeat ${target.name} within timeout.`;
        } else {
            return `Lost target ${target.name} before it could be killed.`;
        }
    } catch (error) {
        console.error(`${this.bot.username} failed to hunt for food:`, error.message);
        return `Failed to hunt for food: ${error.message}`;
    }
  }

  async clearObstacles() {
    console.log(`${this.bot.username} is stuck, attempting to clear obstacles...`);

    const botPos = this.bot.entity.position;
    const offsets = [
        { x: 0, y: 1, z: 0 }, // Block above
        { x: 0, y: 0, z: 1 }, // Block in front
        { x: 0, y: -1, z: 0 }, // Block below (if trapped)
    ];

    for (const offset of offsets) {
        const block = this.bot.blockAt(botPos.offset(offset.x, offset.y, offset.z));

        if (block && block.name.includes('leaves')) {
            console.log(`${this.bot.username} found leaves blocking movement: ${block.name}, breaking...`);
            try {
                await this.bot.dig(block);
                console.log(`${this.bot.username} cleared the leaves.`);
                return; // Exit early if the bot digs successfully
            } catch (error) {
                console.error(`${this.bot.username} failed to break leaves:`, error.message);
            }
        }
    }

    // If no leaves were detected, try jumping to get unstuck
    console.log(`${this.bot.username} is still stuck, attempting to jump.`);
    this.bot.setControlState('jump', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.bot.setControlState('jump', false);
}

  async ensureAboveGround() {
    const botY = this.bot.entity.position.y;
    if (botY < 62) {  // Adjust based on world terrain
        console.log(`${this.bot.username} is underground at Y=${botY}, attempting to escape.`);

        let attempts = 0;
        while (this.bot.entity.position.y < 62 && attempts < 20) { 
            // Check if there's a block above
            const blockAbove = this.bot.blockAt(this.bot.entity.position.offset(0, 1, 0));

            if (blockAbove && blockAbove.boundingBox === 'block') {
                console.log(`${this.bot.username} is blocked, digging up.`);
                await this.bot.dig(blockAbove);
            } else {
                console.log(`${this.bot.username} jumping to get to surface.`);
                this.bot.setControlState('jump', true);
                await new Promise(resolve => setTimeout(resolve, 500));
                this.bot.setControlState('jump', false);
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`${this.bot.username} should be above ground now.`);
    }
  }

  async goUnderground(depth = 10) {
    console.log(`${this.bot.username} is digging underground...`);

    const botPos = this.bot.entity.position;

    // Ensure there's no lava or water below before digging
    const checkBlock = (pos) => {
        const block = this.bot.blockAt(pos);
        return block && (block.name.includes('lava') || block.name.includes('water'));
    };

    // Move bot to a safe spot before digging
    const safePosition = botPos.floored();
    if (checkBlock(safePosition.offset(0, -1, 0))) {
        console.log(`${this.bot.username} found lava/water below. Searching for a safer spot.`);
        return "Unsafe to dig here!";
    }

    try {
        for (let i = 0; i < depth; i++) {
            const blockBelow = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));

            if (!blockBelow || blockBelow.name === 'air') {
                console.log(`${this.bot.username} reached an air pocket underground.`);
                break;
            }

            console.log(`${this.bot.username} digging down at Y=${this.bot.entity.position.y}`);
            await this.bot.dig(blockBelow);
            
            // Step down after digging
            this.bot.setControlState('jump', false);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`${this.bot.username} reached target depth.`);
        return "Successfully dug underground!";
    } catch (error) {
        console.error(`${this.bot.username} encountered an error while digging underground:`, error.message);
        return `Failed to dig underground: ${error.message}`;
    }
  }


}

module.exports = Bot;