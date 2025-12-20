/**
 * Command functions that wrap SnakeGame methods.
 * Each function takes a SnakeGame and returns a new SnakeGame.
 * All functions are max 3 lines (following MIT 6.102 best practices).
 */

import { SnakeGame, Direction } from './snake.js';

/**
 * Handles a direction input from the client.
 * @param game the current game state
 * @param direction the new direction
 * @returns the updated game state
 */
export function handleDirectionInput(game: SnakeGame, direction: Direction): SnakeGame {
  return game.setDirection(direction);
}

/**
 * Advances the game by one tick.
 * @param game the current game state
 * @returns the updated game state
 */
export function handleTick(game: SnakeGame): SnakeGame {
  return game.tick();
}

/**
 * Starts a new game.
 * @returns a fresh game instance
 */
export function handleNewGame(): SnakeGame {
  return new SnakeGame();
}
