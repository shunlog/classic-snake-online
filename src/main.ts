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

// There are three timings:
// 1. Physics ticks (fixed rate)
// 2. Snake ticks (the rate at which the snake moves)
// 3. Render ticks (based on frame rate, provided by getAnimationFrame)

// Physics ticks have to happen at a fixed rate for consistent gameplay.
// The browser API requestAnimationFrame gives us the time since last frame update,
// so we make sure to call the update function multiple times if needed to catch up.

// Fixed timestep constants
const PHYSICS_TICK = 1 / 60; // 60 Hz (in seconds)
const SNAKE_TICK = 10 * PHYSICS_TICK; // Convert to seconds

let physicsTimeAcc = 0;  // seconds, accumulated since last physics update
let lastFrameTime = performance.now() / 1000;
let tickTimeAcc = 0;  // seconds, accumulated since last snake tick

// Game state
let game: SnakeGame = newGame(GRID_WIDTH, GRID_HEIGHT);

// FPS tracking
let fpsFrames = 0;
let fpsLastTime = performance.now();
let currentFPS = 60;

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
    update(0);
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
            if (status === 'NOT_STARTED' || status === 'GAME_OVER') {
                restartGame();
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
 * Reset the game and timing state
 */
function restartGame(): void {
    game = SnakeGame.create(GRID_WIDTH, GRID_HEIGHT);
    start(game);
    tickTimeAcc = 0;
    physicsTimeAcc = 0;
    lastFrameTime = performance.now() / 1000;
}

/**
 * Update game state (called with fixed timestep, in seconds)
 */
function physics_update(dt: number): void {
    if (getStatus(game) !== 'PLAYING') {
        return;
    }
    // Accumulate time for game ticks
    tickTimeAcc += dt;
    if (tickTimeAcc >= SNAKE_TICK) {
        game = tick(game);
        tickTimeAcc -= SNAKE_TICK;
    }
    
}

/**
 * Main game loop with fixed timestep
 */
function update(nowMs: number): void {
    const now = nowMs / 1000; // Convert to seconds
    let frame_dt = now - lastFrameTime;
    lastFrameTime = now;
    // Avoid spiral of death (cap at 250ms)
    frame_dt = Math.min(frame_dt, 0.25);

    // Calculate FPS
    fpsFrames++;
    const fpsElapsed = performance.now() - fpsLastTime;
    if (fpsElapsed >= 1000) { // Update FPS every second
        currentFPS = Math.round((fpsFrames * 1000) / fpsElapsed);
        fpsFrames = 0;
        fpsLastTime = performance.now();
    }

    // Update with fixed timestep
    physicsTimeAcc += frame_dt;
    while (physicsTimeAcc >= PHYSICS_TICK) {
        physics_update(PHYSICS_TICK);
        physicsTimeAcc -= PHYSICS_TICK;
    }

    // Render
    render();

    // Continue loop
    requestAnimationFrame(update);
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

    // Update FPS display
    const fpsElement = document.getElementById('fps');
    if (fpsElement) {
        fpsElement.textContent = `FPS: ${currentFPS}`;
        // Color code: green if good, yellow if medium, red if bad
        if (currentFPS >= 55) {
            fpsElement.style.color = '#4a7c2c';
        } else if (currentFPS >= 30) {
            fpsElement.style.color = '#ff8800';
        } else {
            fpsElement.style.color = '#ff4444';
        }
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
