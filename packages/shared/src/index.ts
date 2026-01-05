/**
 * Shared package exports
 * Provides game logic ADT and WebSocket message types
 */

export { SnakeGame, GameOverError, Direction } from './snake.js';
export type { Position, SnakeGameDTO } from './snake.js';

export * from './messages.js';
