/**
 * Simple dummy server for Classic Snake
 * Provides a basic endpoint for demonstration
 */

import { SnakeGame } from '@snake/shared';

interface ApiResponse {
  message: string;
  timestamp: string;
  gameInfo?: {
    version: string;
    description: string;
  };
}

/**
 * Dummy endpoint that returns game information
 */
export function getGameInfo(): ApiResponse {
  return {
    message: 'Classic Snake Server API',
    timestamp: new Date().toISOString(),
    gameInfo: {
      version: '1.0.0',
      description: 'Classic Snake game with TypeScript and ADT design',
    },
  };
}

/**
 * Create a new game instance (server-side)
 */
export function createServerGame(width: number, height: number, snakeLength: number): SnakeGame {
  return SnakeGame.create(width, height, snakeLength);
}

// Simple HTTP server if running in Node environment
const isNode = typeof globalThis !== 'undefined' && !('window' in globalThis);
if (isNode) {
  console.log('Server initialized');
  console.log('API endpoint: /api/info');
  console.log(JSON.stringify(getGameInfo(), null, 2));
}
