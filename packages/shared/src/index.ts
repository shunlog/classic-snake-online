/**
 * Shared package exports
 * Provides game logic ADT and WebSocket message types
 */

export { SnakeGame, Direction, GameStatus } from './snake.js';
export type { Position, GameState } from './snake.js';

export type {
  ClientMessage,
  ServerMessage,
  JoinMessage,
  JoinedMessage,
  PlayersListMessage,
  TickMessage,
  ErrorMessage,
  PlayerInfo
} from './messages.js';
