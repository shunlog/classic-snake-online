/**
 * Main game loop and rendering
 * 
 * This module orchestrates the game by:
 * - Managing the game loop
 * - Handling user input
 * - Rendering to HTML canvas
 */

import { SnakeGame, Direction, GameOverError } from '@snake/shared';
import { GameLoop } from './gameLoop.js';
import { draw, initDraw } from './draw.js';

export type GameStatus = 'NOT_STARTED' | 'PLAYING' | 'GAME_OVER';

const SNAKE_LENGTH = 4; // Initial snake length

// Tick duration when the snake moves (seconds)
const SNAKE_TICK = 0.2; // 200 ms

let dtAcc = 0;  // seconds, accumulated since last snake tick
let status: GameStatus = 'NOT_STARTED';

// Game state
let game: SnakeGame;
resetGame();

function resetGame(): void {
    game = new SnakeGame(20, 20, SNAKE_LENGTH);
    dtAcc = 0;
}

function startGame(): void {
    status = 'PLAYING';
}

// Game loop instance
let gameLoop: GameLoop = new GameLoop({
    update: _update,
    render: _draw,
    handleInput: _handle_input
});

/**
 * Initialize the game
 */
function init(): void {
    initDraw();
    gameLoop.start();
}

/**
 * Handle keyboard input
 */
function _handle_input(event: KeyboardEvent): void {
    // Start/restart game with spacebar
    if (event.code === 'Space') {
        event.preventDefault();
        if (status === 'NOT_STARTED') {
            status = 'PLAYING';
        } else if (status === 'GAME_OVER') {
            resetGame();
            startGame();
        }
        return;
    }

    // Direction input (only during gameplay)
    if (status !== 'PLAYING') {
        return;
    }

    let direction: Direction | null = null;

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            direction = 'UP';
            event.preventDefault();
            break;
        case 'ArrowDown':
        case 'KeyS':
            direction = 'DOWN';
            event.preventDefault();
            break;
        case 'ArrowLeft':
        case 'KeyA':
            direction = 'LEFT';
            event.preventDefault();
            break;
        case 'ArrowRight':
        case 'KeyD':
            direction = 'RIGHT';
            event.preventDefault();
            break;
    }

    if (direction !== null) {
        game.queueDirection(direction);
    }
}


/**
 * Update game state (called with fixed timestep, in seconds)
 */
function _update(dt: number): void {
    if (status !== 'PLAYING') {
        return;
    }

    dtAcc += dt;
    if (dtAcc >= SNAKE_TICK) {
        try {
            game.tick();
        } catch (error) {
            if (error instanceof GameOverError) {
                status = 'GAME_OVER';
            } else {
                throw error;
            }
        }
        dtAcc -= SNAKE_TICK;
    }
}

function _draw(): void {
    draw(game, gameLoop.fps, status);
}

// Start the game when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}
