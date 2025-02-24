const mineflayer = require('mineflayer');
const WebSocket = require('ws');
const { pathfinder, Movements, goals: { GoalNear, GoalBlock } } = require('mineflayer-pathfinder');
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
        this.bot.chat('/tp @s -161 -42 -3');

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
                this.hunt().then(() => {
                    ws.send(JSON.stringify({ type: "hunting", status: "done" }));
                }).catch(err => {
                    ws.send(JSON.stringify({ type: "hunting", status: "error", error: err.message }));
                });
            } else if (String(message).trim() === 'aboveground') {
                this.ensureAboveGround();
            } else if (String(message).trim() === 'dig') {
                this.goUnderground();
            } else if (String(message).trim() === 'meetup') {
                this.meetUp().then(() => {
                    ws.send(JSON.stringify({ type: "meetup", status: "done" }));
                }).catch(err => {
                    ws.send(JSON.stringify({ type: "meetup", status: "error", error: err.message }));
                });
            } else if (String(message).trim() === 'gather') {
                this.gatherMaterials().then(() => {
                    ws.send(JSON.stringify({ type: "gather", status: "done" }));
                }).catch(err => {
                    ws.send(JSON.stringify({ type: "gather", status: "error", error: err.message }));
                });
            } else if (String(message).trim() === 'inventory') {
                this.getInventory().then(inventory => {
                    ws.send(JSON.stringify({ type: "inventory", inventory }));
                });
            }
        });
    });
  }

    async getInventory() {
        const items = this.bot.inventory.items();
        if (items.length === 0) {
            return "Inventory is empty.";
        } else {
            return items.map(item => `${item.name} (${item.count})`).join(", ");
        }
    }

    async findNearbyLand() {
        const searchRadius = 10;
        for (let x = -searchRadius; x <= searchRadius; x++) {
            for (let z = -searchRadius; z <= searchRadius; z++) {
                const position = this.bot.entity.position.offset(x, 0, z);
                const blockBelow = this.bot.blockAt(position.offset(0, -1, 0));
    
                if (blockBelow && blockBelow.name !== 'water') {
                    return position; // Found dry land
                }
            }
        }
        return null; // No land found
    }

    async gatherMaterials() {
        const buildingMaterials = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'hay_block'];
    
        let target = this.bot.findBlock({
            matching: block => buildingMaterials.includes(block.name),
            maxDistance: 64
        });
    
        if (!target) return "No building materials found nearby.";
    
        console.log(`${this.bot.username} engaging target ${target.name} at ${target.position}`);
    
        try {
            const mcData = require('minecraft-data')(this.bot.version);
            const movements = new Movements(this.bot, mcData);
            movements.allowParkour = true;  
            movements.allow1by1towers = true; 
            movements.canSwim = true; 
            this.bot.pathfinder.setMovements(movements);
    
            await this.bot.pathfinder.goto(new goals.GoalBlock(target.position.x, target.position.y, target.position.z));
    
            console.log(`${this.bot.username} preparing to break ${target.name}`);
    
            // **Equip the best tool before digging**
            if (target.name.includes("log")) {
                await this.bot.equip(mcData.itemsByName.iron_axe.id, 'hand').catch(() => {});
            } else if (target.name.includes("hay")) {
                await this.bot.equip(mcData.itemsByName.shears?.id || mcData.itemsByName.iron_hoe?.id, 'hand').catch(() => {});
            }
    
            this.bot.clearControlStates();
            this.bot.setControlState('sneak', true); // Prevents movement during digging
    
            // **Try Digging & Ignore "Aborted" If Block Is Gone**
            try {
                await this.bot.dig(target, true);
            } catch (err) {
                if (err.message.includes('Digging aborted')) {
                    const checkBlock = this.bot.blockAt(target.position);
                    if (!checkBlock || checkBlock.name !== target.name) {
                        console.log(`${this.bot.username} successfully broke ${target.name} despite digging aborted message.`);
                    } else {
                        console.log(`${this.bot.username} retrying to break ${target.name}.`);
                        await this.bot.dig(target, true);
                    }
                } else {
                    throw err;
                }
            }
    
            this.bot.setControlState('sneak', false);
    
            console.log(`${this.bot.username} gathered ${target.name}!`);
            return `Gathering building materials (${target.name}) succeeded.`;
    
        } catch (error) {
            console.error(`${this.bot.username} failed to gather materials:`, error.message);
            return `Failed to gather materials: ${error.message}`;
        }
    }

    async meetUp() {
        if (!this.bot.pathfinder) this.bot.loadPlugin(pathfinder);

        const movements = new Movements(this.bot, mcData);
        movements.allowParkour = false;
        movements.canSwim = false; 
        movements.allow1by1towers = false; 

        this.bot.pathfinder.setMovements(movements);

        const meetupLocation = new Vec3(-154, -42, 1);
        console.log(`${this.bot.username} heading to meetup at ${meetupLocation.x}, ${meetupLocation.y}, ${meetupLocation.z}`);
        this.bot.chat(`Heading to meetup at ${meetupLocation.x}, ${meetupLocation.y}, ${meetupLocation.z}`);

        return new Promise((resolve, reject) => {
            this.bot.pathfinder.setGoal(new GoalBlock(meetupLocation.x, meetupLocation.y, meetupLocation.z));

            this.bot.once('goal_reached', () => {
                console.log(`${this.bot.username} arrived at the meetup location.`);
                resolve();
            });

            this.bot.once('path_stop', () => {
                reject(new Error('Pathfinding stopped before reaching the destination.'));
            });

            this.bot.once('goal_error', (err) => {
                reject(err);
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
            movements.allowParkour = true;
            movements.canSwim = false;  
            this.bot.pathfinder.setMovements(movements);

            this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);

            const maxTime = 180000;
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