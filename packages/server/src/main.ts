/**
 * WebSocket server for Classic Snake
 * Handles multiplayer connections and game coordination
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { ServerMessage } from '@snake/shared';
import {
  handleConnection,
  handleMessage,
  handleClose,
  handleError,
  parseClientMessage,
  InvalidClientMessageError,
  handleTick
} from './game.js';

const TICK_HZ = 20;
const TICK_INTERVAL_MS = 1000 / TICK_HZ;
const SIMULATED_LATENCY_MS = 40; // Set to >0 to simulate latency for testing

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a typed message to a WebSocket client
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    if (SIMULATED_LATENCY_MS > 0) {
      setTimeout(() => {
        ws.send(JSON.stringify(message));
      }, SIMULATED_LATENCY_MS);
    } else {
      ws.send(JSON.stringify(message));
    }
  }
}

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 11);
  return `connection_${randomSuffix}`;
}

/**
 * Start WebSocket server on specified port
 */
function startWebSocketServer(port: number): void {
  const wss = new WebSocketServer({ port });

  wss.on('connection', async (ws: WebSocket) => {
    const connectionId = generateConnectionId();
    const sendMsgCallback = (message: ServerMessage) => sendMessage(ws, message);

    if (!handleConnection(connectionId, sendMsgCallback)) {
      ws.close();
      return;
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const message = parseClientMessage(data);
        if (SIMULATED_LATENCY_MS > 0) {
          await sleep(SIMULATED_LATENCY_MS);
          await handleMessage(message, connectionId, sendMsgCallback);
        } else {
          await handleMessage(message, connectionId, sendMsgCallback);
        }

      } catch (error) {
        if (error instanceof InvalidClientMessageError) {
          console.error(error.message);
          return;
        }
        throw error;
      }
    });

    ws.on('close', () => {
      handleClose(connectionId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleError(connectionId);
    });
  });

  console.log(`WebSocket server running on ws://localhost:${port}`);
}

function startGameLoop(): void {
  setInterval(() => {
    handleTick();
  }, TICK_INTERVAL_MS);
}

// Start server if running in Node environment
const isNode = typeof globalThis !== 'undefined' && !('window' in globalThis);
if (isNode) {
  startWebSocketServer(3001);
  startGameLoop();
}
