import websocket
import threading


class BotClient:
    def __init__(self, name, uri):
        self.name = name
        self.uri = uri
        self.ws = None

    def on_message(self, ws, message):
        """Called when a message is received"""
        print(f"{self.name}: Received message: {message}")

    def on_open(self, ws):
        """Called when the connection is opened"""
        print(f"{self.name}: Connected to {self.uri}")

    def on_error(self, ws, error):
        """Called when an error occurs"""
        print(f"{self.name}: Error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """Called when the connection is closed"""
        print(f"{self.name}: Connection closed")

    def hunt(self):
        """Hunt for a player"""
        self.ws.send("hunt")

    def gather(self):
        """Gather materials"""
        self.ws.send("gather")

    def inventory(self):
        """Get inventory"""
        self.ws.send("inventory")

    def farm(self):
        """Farm"""
        self.ws.send("farm")

    def meetup(self):
        """Meetup"""
        self.ws.send("meetup")

    def aboveground(self):
        """Go aboveground"""
        self.ws.send("aboveground")

    def dig(self):
        """Dig"""
        self.ws.send("dig")

    def connect(self):
        """Creates and runs the WebSocket in a separate thread"""
        self.ws = websocket.WebSocketApp(
            self.uri,
            on_message=self.on_message,
            on_open=self.on_open,
            on_error=self.on_error,
            on_close=self.on_close,
        )

        # Run WebSocket in a background thread
        thread = threading.Thread(target=self.ws.run_forever, daemon=True)
        thread.start()

# client = BotClient("Bot1", "ws://localhost:8000/v1/realtime?patient_id=1", auth_token="your_auth_token")

client = BotClient("Bot1", "ws://localhost:8081")
client.connect()
# Example usage
# async def main():
#     def custom_message_handler(message):
#         print(f"Custom handler: {message}")

#     client = BotClient("Bot1", 12345, on_message_callback=custom_message_handler)
#     await client.connect()

#     # The client is now connected, and messages will trigger `custom_message_handler`.
#     # Other async tasks can continue running without being blocked.

#     await asyncio.sleep(999999)  # Keep the script alive for testing.

# if __name__ == '__main__':
#     async def main():
#         # Instantiate 4 clients for bot1, bot2, bot3, bot4
#         client1 = BotClient('bot1', 8081)
#         client2 = BotClient('bot2', 8082)
#         client3 = BotClient('bot3', 8083)
#         client4 = BotClient('bot4', 8084)
        
#         # Start all clients
#         client1.start()
#         client2.start()
#         client3.start()
#         client4.start()

#         # Keep the event loop running
#         while True:
#             await asyncio.sleep(1)

#     asyncio.run(main()) 