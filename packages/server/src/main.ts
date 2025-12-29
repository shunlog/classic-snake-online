/**
 * Server-authoritative Snake Game Server
 * Runs game logic server-side and sends state updates to clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { SnakeGame, Direction, GameState } from '@snake/shared';

// Game constants
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const SNAKE_LENGTH = 4;
const TICK_INTERVAL_MS = 100; // 100ms per tick

// Network simulation
const MIN_DELAY_MS = 30;
const MAX_DELAY_MS = 50;

/**
 * Get random delay between MIN_DELAY_MS and MAX_DELAY_MS
 */
function getRandomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

// Message types
interface InputMessage {
  type: 'start' | 'restart' | 'direction';
  direction?: Direction;
}

interface StateMessage {
  type: 'state';
  state: GameState;
}

/**
 * Game session for a connected client
 */
class GameSession {
  private game: SnakeGame;
  private tickInterval: NodeJS.Timeout | null = null;
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.game = SnakeGame.create(GRID_WIDTH, GRID_HEIGHT, SNAKE_LENGTH);
    this.sendState();
  }

  /**
   * Handle input message from client (with simulated network delay)
   */
  handleInput(message: InputMessage): void {
    // Simulate network latency
    setTimeout(() => {
      try {
        switch (message.type) {
          case 'start':
            this.start();
            break;
          case 'restart':
            this.restart();
            break;
          case 'direction':
            if (message.direction) {
              this.queueDirection(message.direction);
            }
            break;
        }
      } catch (error) {
        console.error('Error handling input:', error);
      }
    }, getRandomDelay());
  }

  /**
   * Start the game
   */
  private start(): void {
    if (this.game.getStatus() !== 'NOT_STARTED') {
      return;
    }

    this.game = this.game.start();
    this.sendState();
    this.startTickLoop();
  }

  /**
   * Restart the game
   */
  private restart(): void {
    this.stopTickLoop();
    this.game = SnakeGame.create(GRID_WIDTH, GRID_HEIGHT, SNAKE_LENGTH);
    this.game = this.game.start();
    this.sendState();
    this.startTickLoop();
  }

  /**
   * Queue a direction change
   */
  private queueDirection(direction: Direction): void {
    if (this.game.getStatus() === 'PLAYING') {
      this.game = this.game.queueDirection(direction);
    }
  }

  /**
   * Start the tick loop
   */
  private startTickLoop(): void {
    if (this.tickInterval !== null) {
      return;
    }

    this.tickInterval = setInterval(() => {
      if (this.game.getStatus() === 'PLAYING') {
        this.game = this.game.tick();
        this.sendState();

        // Stop loop if game is over
        if (this.game.getStatus() === 'GAME_OVER') {
          this.stopTickLoop();
        }
      }
    }, TICK_INTERVAL_MS);
  }

  /**
   * Stop the tick loop
   */
  private stopTickLoop(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Send current game state to client (with simulated network delay)
   */
  private sendState(): void {
    const message: StateMessage = {
      type: 'state',
      state: this.game.serialize()
    };

    // Simulate network latency
    setTimeout(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }, getRandomDelay());
  }

  /**
   * Clean up when client disconnects
   */
  cleanup(): void {
    this.stopTickLoop();
  }
}

/**
 * Start WebSocket server on specified port
 */
function startWebSocketServer(port: number = 3000): void {
  const wss = new WebSocketServer({ port });
  const sessions = new Map<WebSocket, GameSession>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    // Create game session for this client
    const session = new GameSession(ws);
    sessions.set(ws, session);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as InputMessage;
        const session = sessions.get(ws);
        if (session) {
          session.handleInput(message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      const session = sessions.get(ws);
      if (session) {
        session.cleanup();
        sessions.delete(ws);
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
