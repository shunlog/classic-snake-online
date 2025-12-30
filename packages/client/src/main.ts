/**
 * Client with Prediction - Runs local simulation and reconciles with server
 * 
 * Client predicts game state locally for responsive controls,
 * then reconciles with authoritative server state.
 */

import { SnakeGame, Direction, GameState } from '@snake/shared';
import { GameLoop } from './gameLoop.js';

// Canvas and rendering constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;
const CELL_SIZE = 20;
const GRID_WIDTH = CANVAS_WIDTH / CELL_SIZE;  // 20
const GRID_HEIGHT = CANVAS_HEIGHT / CELL_SIZE; // 20
const SNAKE_LENGTH = 4;
const TICK_INTERVAL_MS = 200; // Must match server

// WebSocket connection
let ws: WebSocket | null = null;

// Client prediction state
let predictedGame: SnakeGame | null = null;
let lastServerState: GameState | null = null;
let pendingInputs: Array<{ direction: Direction; tick: number }> = [];
let tickAccumulator = 0;

// Message types
interface InputMessage {
  type: 'start' | 'restart' | 'direction';
  direction?: Direction;
  clientTick?: number;
}

interface StateMessage {
  type: 'state';
  state: GameState;
}

/**
 * Initialize WebSocket connection
 */
function initWebSocket(): void {
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
        console.log('WebSocket connected to server');
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data) as StateMessage;
            if (message.type === 'state') {
                lastServerState = message.state;
                reconcileWithServer(message.state);
                console.log(`[Client] Received server state: tick ${message.state.tickCount}`);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        lastServerState = null;
        predictedGame = null;
        // Attempt to reconnect after 2 seconds
        setTimeout(initWebSocket, 2000);
    };
}

/**
 * Reconcile predicted state with authoritative server state
 */
function reconcileWithServer(serverState: GameState): void {
    // Remove inputs that have been processed by the server
    pendingInputs = pendingInputs.filter(input => input.tick > serverState.tickCount);
    const serverTick = serverState.tickCount;
    const currentTick = predictedGame ? predictedGame.getTickCount() : serverTick + 3;
    console.log(`[Client] Reconciling: serverTick=${serverTick}, predictedTick=${currentTick}, pendingInputs=${pendingInputs.length}`);
    // Reset predicted game to server state
    predictedGame = SnakeGame.fromState(serverState);

    // Re-apply pending inputs
    for (const input of pendingInputs) {
        if (predictedGame && predictedGame.getStatus() === 'PLAYING') {
            if (input.tick > predictedGame.getTickCount()) {
                predictedGame = predictedGame.tick();
            }
            predictedGame = predictedGame.queueDirection(input.direction);
        }
    }
    while(predictedGame.getTickCount() < currentTick) {
        if (predictedGame.getStatus() !== 'PLAYING') {
            break;
        }
        predictedGame = predictedGame.tick();
    }

    if (predictedGame) {
        console.log(
            `[Client] Reconciled: serverTick=${serverTick}, ` +
            `predictedTick=${predictedGame.serialize().tickCount}, ` +
            `pendingInputs=${pendingInputs.length}`
        );
    }
}

/**
 * Send input message to server
 */
function sendInput(message: InputMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
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
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Initialize WebSocket connection
    initWebSocket();

    gameLoop.start();
}

/**
 * Handle keyboard input
 */
function _handle_input(event: KeyboardEvent): void {
    if (!lastServerState) return;

    // Start/restart game with spacebar
    if (event.code === 'Space') {
        event.preventDefault();
        if (lastServerState.status === 'NOT_STARTED') {
            sendInput({ type: 'start' });
            // Initialize predicted game when starting
            predictedGame = SnakeGame.create(GRID_WIDTH, GRID_HEIGHT, SNAKE_LENGTH);
            predictedGame = predictedGame.start();
        } else if (lastServerState.status === 'GAME_OVER') {
            sendInput({ type: 'restart' });
            pendingInputs = [];
            predictedGame = null;
        }
        return;
    }

    // Direction input (only during gameplay)
    if (lastServerState.status !== 'PLAYING' || !predictedGame) {
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
        const clientTick = predictedGame.serialize().tickCount;
        
        // Apply input locally for prediction
        predictedGame = predictedGame.queueDirection(direction);
        
        // Store input for reconciliation
        pendingInputs.push({ direction, tick: clientTick });
        
        // Send input to server with tick number
        sendInput({ type: 'direction', direction, clientTick });
        
        console.log(`[Client] Sent input: direction=${direction}, clientTick=${clientTick}`);
    }
}


/**
 * Update game state - run client-side prediction
 */
function _update(dt: number): void {
    if (!predictedGame || predictedGame.getStatus() !== 'PLAYING') {
        return;
    }

    tickAccumulator += dt * 1000; // Convert to ms

    while (tickAccumulator >= TICK_INTERVAL_MS) {
        predictedGame = predictedGame.tick();
        tickAccumulator -= TICK_INTERVAL_MS;
    }
}

/**
 * Render the game state to canvas
 */
function _draw(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine which state to render (predicted if available, otherwise server state)
    let state: GameState | null = null;
    if (predictedGame) {
        state = predictedGame.serialize();
    } else if (lastServerState) {
        state = lastServerState;
    }

    // If no state yet, show loading
    if (!state) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#333';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Connecting to server...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        return;
    }

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
        const fps = gameLoop.fps;
        fpsElement.textContent = `FPS: ${fps} | Ticks: ${state.tickCount}`;
        // Color code: green if good, yellow if medium, red if bad
        if (fps >= 55) {
            fpsElement.style.color = '#4a7c2c';
        } else if (fps >= 30) {
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
