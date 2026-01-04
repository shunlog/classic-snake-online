/**
 * WebSocket server for Classic Snake
 * Handles multiplayer connections and game coordination
 */

import { WebSocketServer, WebSocket } from 'ws';
import type {
  ClientMessage,
  ServerMessage,
  JoinedMessage,
  PlayersListMessage,
  ErrorMessage
} from '@snake/shared';

const MAX_PLAYERS = 2;

interface Player {
  id: string;
  ws: WebSocket;
  name: string;
}

// Global lobby
const players = new Map<string, Player>();

/**
 * Send a typed message to a WebSocket client
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Parse incoming message data into a typed ClientMessage
 */
function parseMessage(data: Buffer): ClientMessage {
  return JSON.parse(data.toString()) as ClientMessage;
}

/**
 * Generate a unique player ID
 */
function generatePlayerId(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 11);
  return `player_${randomSuffix}`;
}

/**
 * Broadcast player list to all connected clients
 */
function broadcastPlayerList(): void {
  const playerList = Array.from(players.values()).map(p => ({
    id: p.id,
    name: p.name
  }));

  const message: PlayersListMessage = {
    type: 'players',
    players: playerList
  };

  players.forEach(player => {
    sendMessage(player.ws, message);
  });
}

/**
 * Handle incoming client message
 */
function handleMessage(
  message: ClientMessage,
  ws: WebSocket,
  playerId: string
): void {
  switch (message.type) {
    case 'join':
      const player: Player = {
        id: playerId,
        ws,
        name: message.name || `Player ${players.size + 1}`
      };

      players.set(playerId, player);
      console.log(`Player ${player.name} (${playerId}) joined. Total players: ${players.size}`);

      // Send confirmation to the joining player
      const joinedMsg: JoinedMessage = {
        type: 'joined',
        playerId,
        name: player.name
      };
      sendMessage(ws, joinedMsg);

      // Broadcast updated player list
      broadcastPlayerList();
      break;

    case 'tick':
      // Echo the message back to the client
      sendMessage(ws, message);
      break;
  }
}

/**
 * Start WebSocket server on specified port
 */
function startWebSocketServer(port: number): void {
  const wss = new WebSocketServer({ port });

  wss.on('connection', async (ws: WebSocket) => {
    const playerId = generatePlayerId();

    // Check if lobby is full
    if (players.size >= MAX_PLAYERS) {
      const errorMsg: ErrorMessage = { type: 'error', message: 'Lobby is full' };
      sendMessage(ws, errorMsg);
      ws.close();
      console.log('Connection rejected: lobby is full');
      return;
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const message = parseMessage(data);
        handleMessage(message, ws, playerId);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      if (players.has(playerId)) {
        const player = players.get(playerId)!;
        players.delete(playerId);
        console.log(`Player ${player.name} (${playerId}) disconnected. Total players: ${players.size}`);
        
        // Broadcast updated player list
        broadcastPlayerList();
      }
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
