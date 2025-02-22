import asyncio
import websockets
import subprocess
import time


class LLMController:
    def __init__(self, ws_host='localhost', ws_port=8765):
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.bot_process = self.create_bot()
        self.websocket = None

    def create_bot(self):
        # Spawn the mineflayer bot as a Node.js process. You may need to adjust the command if your bot file is elsewhere.
        print(f"Starting mineflayer bot on websocket port {self.ws_port}...")
        process = subprocess.Popen([
            'node', 'bot.js', str(self.ws_port)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        # Allow some time for the bot to initialize
        time.sleep(3)
        return process

    async def connect_to_bot(self):
        uri = f"ws://{self.ws_host}:{self.ws_port}"
        print(f"Connecting to bot at {uri}...")
        self.websocket = await websockets.connect(uri)
        print("Connected!")
        return self.websocket

    async def send_message(self, message):
        if self.websocket:
            await self.websocket.send(message)
            print(f"Sent message to bot: {message}")
        else:
            print("Not connected to bot.")

    async def receive_message(self):
        if self.websocket:
            message = await self.websocket.recv()
            print(f"Received message from bot: {message}")
            return message
        else:
            print("Not connected to bot.")
            return None

    def close(self):
        if self.bot_process:
            self.bot_process.terminate()
            self.bot_process.wait()
            print("Bot process terminated.")


if __name__ == '__main__':
    controller = LLMController(ws_port=8765)
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(controller.connect_to_bot())
        # For demonstration, send a message and wait for echo from the bot
        loop.run_until_complete(controller.send_message('Hello, bot!'))
        loop.run_until_complete(controller.receive_message())
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        controller.close()
        # To keep the websocket alive if needed, use loop.run_forever() 