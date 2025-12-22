/**
 * Main game loop and rendering
 * 
 * This module orchestrates the game by:
 * - Managing the game loop
 * - Handling user input
 * - Rendering to HTML canvas
 * 
 * IMPORTANT: This module ONLY calls functions from commands.ts
 * It never calls SnakeGame methods directly.
 */

import { SnakeGame, Direction, GameState } from './snake.js';
import { 
    tick, 
    queueDirection, 
    newGame, 
    restart, 
    start,
    getState,
    getStatus
} from './commands.js';

// Canvas and rendering constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;
const CELL_SIZE = 20;
const GRID_WIDTH = CANVAS_WIDTH / CELL_SIZE;  // 20
const GRID_HEIGHT = CANVAS_HEIGHT / CELL_SIZE; // 20
const TICK_INTERVAL = 150; // milliseconds

// Game state
let game: SnakeGame = newGame(GRID_WIDTH, GRID_HEIGHT);
let lastTickTime = 0;

/**
 * Initialize the game
 */
function init(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    setupInputHandlers();
    gameLoop(0);
}

/**
 * Setup keyboard input handlers
 */
function setupInputHandlers(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
        // Start/restart game with spacebar
        if (event.code === 'Space') {
            event.preventDefault();
            const status = getStatus(game);
            
            if (status === 'NOT_STARTED') {
                game = start(game);
            } else if (status === 'GAME_OVER') {
                game = restart(game);
                game = start(game);
            }
            return;
        }

        // Direction input (only during gameplay)
        if (getStatus(game) !== 'PLAYING') {
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
            game = queueDirection(game, direction);
        }
    });
}

/**
 * Main game loop
 */
function gameLoop(timestamp: number): void {
    // Handle game ticks
    if (getStatus(game) === 'PLAYING') {
        const elapsed = timestamp - lastTickTime;
        
        if (elapsed >= TICK_INTERVAL) {
            game = tick(game);
            lastTickTime = timestamp;
        }
    }

    // Render
    render();

    // Continue loop
    requestAnimationFrame(gameLoop);
}

/**
 * Render the game state to canvas
 */
function render(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state: GameState = getState(game);

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(CANVAS_WIDTH, y * CELL_SIZE);
        ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(
        state.food.x * CELL_SIZE + 2,
        state.food.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
    );

    // Draw snake
    state.snake.forEach((segment, index) => {
        // Head is darker
        ctx.fillStyle = index === 0 ? '#2d5016' : '#4a7c2c';
        ctx.fillRect(
            segment.x * CELL_SIZE + 1,
            segment.y * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
        );
    });

    // Update score display
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${state.score}`;
    }

    // Update time display
    const timeElement = document.getElementById('time');
    if (timeElement) {
        const seconds = Math.floor(state.elapsedTime / 1000);
        timeElement.textContent = `Time: ${seconds}s`;
    }

    // Update status display
    const statusElement = document.getElementById('status');
    if (statusElement) {
        if (state.status === 'NOT_STARTED') {
            statusElement.textContent = 'Press SPACE to start';
            statusElement.style.display = 'block';
        } else if (state.status === 'GAME_OVER') {
            statusElement.textContent = `Game Over! Score: ${state.score}. Press SPACE to restart`;
            statusElement.style.display = 'block';
        } else {
            statusElement.style.display = 'none';
        }
    }
}

// Start the game when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}
