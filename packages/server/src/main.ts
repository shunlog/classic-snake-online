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
const TICK_INTERVAL_MS = 200; // 100ms per tick
const SERVER_TICK_DELAY = 3; // Server runs 3 ticks behind client for input buffering

// Network simulation
const MIN_DELAY_MS = 0;
const MAX_DELAY_MS = 1;

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
  clientTick?: number; // Tick number when input was generated on client
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
  private pendingInputs: Map<number, Direction> = new Map(); // clientTick -> direction

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
            if (message.direction && message.clientTick !== undefined) {
              this.queueDirectionAtTick(message.direction, message.clientTick);
            } else if (message.direction) {
              // Fallback for messages without tick (shouldn't happen with prediction)
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
   * Queue a direction change for a specific client tick
   */
  private queueDirectionAtTick(direction: Direction, clientTick: number): void {
    if (this.game.getStatus() !== 'PLAYING') {
      return;
    }

    const currentServerTick = this.game.getTickCount();

    // Check if we've already simulated past this tick
    if (clientTick <= currentServerTick) {
      console.log(
        `[Server] Discarding late input: clientTick=${clientTick}, ` +
        `clientTick=${clientTick}, currentServerTick=${currentServerTick}, ` +
        `late by ${currentServerTick - clientTick} ticks`
      );
      return;
    }

    // Store the input for the target tick
    this.pendingInputs.set(clientTick, direction);
    console.log(
      `[Server] Queued input for tick ${clientTick} (clientTick=${clientTick}), ` +
      `currentServerTick=${currentServerTick}`
    );
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
    this.pendingInputs.clear();
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
    
    this.initialDelayTickInterval = setInterval(() => {clearInterval(this.initialDelayTickInterval)},
     SERVER_TICK_DELAY * TICK_INTERVAL_MS); // Initial delay before starting

    this.tickInterval = setInterval(() => {
      if (this.game.getStatus() === 'PLAYING') {
        const currentTick = this.game.serialize().tickCount;
        
        // Check if there's a pending input for this tick
        const pendingDirection = this.pendingInputs.get(currentTick);
        if (pendingDirection) {
          this.game = this.game.queueDirection(pendingDirection);
          this.pendingInputs.delete(currentTick);
          console.log(`[Server] Applied input at tick ${currentTick}: ${pendingDirection}`);
        }

        // Tick the game
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
