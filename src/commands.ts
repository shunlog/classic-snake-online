/**
 * Commands layer - Thin wrappers around SnakeGame ADT methods
 * 
 * This layer provides a command interface between the main game loop and the SnakeGame ADT.
 * Each command function:
 * - Takes a SnakeGame instance as parameter
 * - Calls one or more ADT methods
 * - Returns the resulting SnakeGame instance
 * - Has at most 3 lines of code
 * 
 * Following MIT 6.102 principles, this separation enables:
 * - Logging and monitoring
 * - Input validation
 * - Future middleware (e.g., undo/redo, networking)
 */

import { SnakeGame, Direction } from './snake.js';

/**
 * Advance game state by one frame
 * 
 * @param game - Current game instance
 * @returns Updated game instance after tick
 */
export function tick(game: SnakeGame): SnakeGame {
    return game.tick();
}

/**
 * Queue a direction change
 * 
 * @param game - Current game instance
 * @param direction - Direction to queue
 * @returns Updated game instance with direction queued
 */
export function queueDirection(game: SnakeGame, direction: Direction): SnakeGame {
    return game.queueDirection(direction);
}

/**
 * Create a fresh game instance
 * 
 * @param gridWidth - Grid width (default: 20)
 * @param gridHeight - Grid height (default: 20)
 * @returns New game instance
 */
export function newGame(gridWidth: number = 20, gridHeight: number = 20): SnakeGame {
    return SnakeGame.create(gridWidth, gridHeight);
}

/**
 * Reset current game
 * 
 * @param game - Current game instance
 * @returns New game instance with same dimensions
 */
export function restart(game: SnakeGame): SnakeGame {
    return game.restart();
}

/**
 * Begin gameplay
 * 
 * @param game - Current game instance
 * @returns Updated game instance in PLAYING state
 */
export function start(game: SnakeGame): SnakeGame {
    return game.start();
}

/**
 * Get game state for rendering
 * 
 * @param game - Current game instance
 * @returns Serialized game state
 */
export function getState(game: SnakeGame) {
    return game.serialize();
}

/**
 * Get current game status
 * 
 * @param game - Current game instance
 * @returns Current game status
 */
export function getStatus(game: SnakeGame) {
    return game.getStatus();
}

/**
 * Get current score
 * 
 * @param game - Current game instance
 * @returns Current score
 */
export function getScore(game: SnakeGame) {
    return game.getScore();
}

/**
 * Get elapsed time
 * 
 * @param game - Current game instance
 * @returns Elapsed time in milliseconds
 */
export function getElapsedTime(game: SnakeGame) {
    return game.getElapsedTime();
}
