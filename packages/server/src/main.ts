/**
 * WebSocket server for Classic Snake
 * Handles tick messages from clients and echoes them back
 */

import { WebSocketServer, WebSocket } from 'ws';

interface TickMessage {
  type: 'tick';
  tickCount: number;
}

/**
 * Start WebSocket server on specified port
 */
function startWebSocketServer(port: number = 3000): void {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as TickMessage;
        
        if (message.type === 'tick') {
          // Echo the message back to the client
          ws.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log(`WebSocket server running on ws://localhost:${port}`);
}

// Start server if running in Node environment
const isNode = typeof globalThis !== 'undefined' && !('window' in globalThis);
if (isNode) {
  startWebSocketServer(3001);
}
