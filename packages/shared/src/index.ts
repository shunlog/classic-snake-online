/**
 * Shared package exports
 * Provides game logic ADT and WebSocket message types
 */

export { SnakeGame, Direction } from './snake.js';
export type { Position, SnakeGameDTO } from './snake.js';

export * from './messages.js';
