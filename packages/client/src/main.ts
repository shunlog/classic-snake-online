/**
 * Main game loop and rendering
 * 
 * This module orchestrates the game by:
 * - Managing the game loop
 * - Handling user input
 * - Rendering to HTML canvas
 */

import { SnakeGame, Direction } from '@snake/shared';
import type { Position } from '@snake/shared';
import type {
    ClientMessage,
    JoinMessage,
    ServerMessage,
    PlayerInfo
} from '@snake/shared';
import { GameLoop } from './gameLoop.js';

// Canvas and rendering constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;
const CELL_SIZE = 20;
const GRID_WIDTH = CANVAS_WIDTH / CELL_SIZE;  // 20
const GRID_HEIGHT = CANVAS_HEIGHT / CELL_SIZE; // 20
const SNAKE_LENGTH = 4; // Initial snake length

// Tick duration when the snake moves (seconds)
const SNAKE_TICK = 0.2; // 200 ms

let dtAcc = 0;  // seconds, accumulated since last snake tick

// WebSocket connection
let ws: WebSocket | null = null;
const pendingMessages = new Map<number, number>(); // tickCount -> timestamp
let playerId: string | null = null;
let players: PlayerInfo[] = [];
let opponentGame: SnakeGame | null = null;
type ClientInput = { tickCount: number; direction: Direction };
const inputHistory: ClientInput[] = [];

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a typed message to the server
 */
function sendMessage(message: ClientMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * Parse incoming message data into a typed ServerMessage
 */
function parseMessage(data: string): ServerMessage {
    return JSON.parse(data) as ServerMessage;
}

/**
 * Handle incoming server message
 */
async function handleMessage(message: ServerMessage): Promise<void> {
    switch (message.type) {
        case 'joined':
            playerId = message.playerId;
            console.log(`Joined as ${message.name} (${playerId})`);
            break;

        case 'players':
            players = message.players;
            updatePlayersList();
            break;

        case 'tick':
            const sendTime = pendingMessages.get(message.tickCount);
            if (sendTime !== undefined) {
                const latency = performance.now() - sendTime;
                console.log(`${message.tickCount == game.getTickCount()} Tick ${message.tickCount}, current ${game.getTickCount()} round-trip: ${latency.toFixed(2)}ms`);
                pendingMessages.delete(message.tickCount);
            }
            const localTick = game.getTickCount();
            // Apply authoritative state from server
            game = SnakeGame.fromDTO(message.playerState);
            opponentGame = SnakeGame.fromDTO(message.opponentState);
            // Reconcile: apply inputs up to and including localTick; tick only to localTick
            if (localTick >= message.tickCount) {
                for (let t = message.tickCount; t <= localTick; t++) {
                    // apply any input recorded for tick t
                    for (let i = 0; i < inputHistory.length; i++) {
                        const inp = inputHistory[i];
                        if (inp.tickCount === t) {
                            game.queueDirection(inp.direction);
                            // remove consumed input to keep buffer small
                            inputHistory.splice(i, 1);
                            break;
                        }
                    }
                    if (t < localTick){
                        game.tick();
                    }
                }
            }
            break;

        case 'time_sync_request':
            sendMessage({
                type: 'time_sync_response',
                requestId: message.requestId,
                clientTimeMs: performance.now()
            });
            break;
        
        case 'game_start':
            console.log('Game starting at client time (ms):', message.startTimeMs);

            // Reconstruct game from DTO received from server
            game = SnakeGame.fromDTO(message.playerState);
            opponentGame = SnakeGame.fromDTO(message.opponentState);
            inputHistory.length = 0;

            const targetTimeMs = message.startTimeMs;
            const countdownElement = document.getElementById('countdown');

            if (countdownElement && typeof targetTimeMs === 'number') {
                countdownElement.style.color = '#666';
                while (performance.now() < targetTimeMs) {
                    const remainingMs = Math.max(0, targetTimeMs - performance.now());
                    const remainingSec = (remainingMs / 1000).toFixed(1);
                    countdownElement.textContent = `Starting in ${remainingSec}s`;
                    await sleep(100);
                }
                countdownElement.textContent = 'Starting...';
            }

            // Start using reconstructed state
            startGame();
            break;

        case 'error':
            console.error('Server error:', message.message);
            updateConnectionStatus(message.message);
            break;
    }
}

/**
 * Initialize WebSocket connection
 */
function initWebSocket(): void {
    ws = new WebSocket('ws://localhost:3001');

    ws.onopen = async () => {
        console.log('WebSocket connected to server');
        // Send join message
        const playerName = `Player ${Math.floor(Math.random() * 1000)}`;
        const joinMsg: JoinMessage = { type: 'join', name: playerName };
        sendMessage(joinMsg);
    };

    ws.onmessage = async (event) => {
        try {
            const message = parseMessage(event.data);
            await handleMessage(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    ws.onerror = async (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = async () => {
        console.log('WebSocket disconnected');
        playerId = null;
        players = [];
        updatePlayersList();
        updateConnectionStatus('Disconnected');
        // Attempt to reconnect after 2 seconds
        setTimeout(initWebSocket, 2000);
    };
}

/**
 * Update the players list in the UI
 */
function updatePlayersList(): void {
    const playersListElement = document.getElementById('playersList');
    if (!playersListElement) return;

    if (players.length === 0) {
        playersListElement.innerHTML = '<li>No players connected</li>';
    } else {
        playersListElement.innerHTML = players.map(p => {
            const isMe = p.id === playerId;
            return `<li${isMe ? ' class="me"' : ''}>${p.name}${isMe ? ' (You)' : ''}</li>`;
        }).join('');
    }
}

/**
 * Update connection status in the UI
 */
function updateConnectionStatus(status: string): void {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Game state
let game: SnakeGame;
resetGame();

function resetGame(): void {
    game = new SnakeGame(GRID_WIDTH, GRID_HEIGHT, SNAKE_LENGTH);
    dtAcc = 0;
}

function startGame(): void {
    game.start();
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
    const opponentCanvas = document.getElementById('opponentCanvas') as HTMLCanvasElement;

    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    if (!opponentCanvas) {
        console.error('Opponent canvas element not found');
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    opponentCanvas.width = CANVAS_WIDTH;
    opponentCanvas.height = CANVAS_HEIGHT;

    // Initialize WebSocket connection
    initWebSocket();

    gameLoop.start();
}

/**
 * Handle keyboard input
 */
function _handle_input(event: KeyboardEvent): void {
    // Start/restart game with spacebar
    if (event.code === 'Space') {
        event.preventDefault();
        const status = game.getStatus();
        if (status === 'NOT_STARTED') {
            game.start();
        } else if (status === 'GAME_OVER') {
            resetGame();
            startGame();
        }
        return;
    }

    // Direction input (only during gameplay)
    if (game.getStatus() !== 'PLAYING') {
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
        // Send input to server with current local tick
        const currentTick = game.getTickCount();
        inputHistory.push({ tickCount: currentTick, direction });
        pendingMessages.set(currentTick, performance.now());
        sendMessage({
            type: 'input',
            direction,
            tickCount: currentTick
        } as ClientMessage);
    }
}


/**
 * Update game state (called with fixed timestep, in seconds)
 */
function _update(dt: number): void {
    if (game.getStatus() !== 'PLAYING') {
        return;
    }

    dtAcc += dt;
    if (dtAcc >= SNAKE_TICK) {
        game.tick();
        dtAcc -= SNAKE_TICK;
    }
}

/**
 * Draw a game to a specific canvas
 */
function drawGame(canvasId: string, game: SnakeGame): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    const food = game.getFood();
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(
        food.x * CELL_SIZE + 2,
        food.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
    );

    // Draw snake
    const snake = game.getSnake();
    snake.forEach((segment: Position, index: number) => {
        // Head is darker
        ctx.fillStyle = index === 0 ? '#2d5016' : '#4a7c2c';
        ctx.fillRect(
            segment.x * CELL_SIZE + 1,
            segment.y * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
        );
    });
}

/**
 * Render the game state to canvas
 */
function _draw(): void {
    // Draw local game
    drawGame('gameCanvas', game);

    // Draw opponent game (authoritative from server if available)
    drawGame('opponentCanvas', opponentGame ?? game);

    // Update score display
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${game.getScore()}`;
    }

    // Update time display
    const timeElement = document.getElementById('time');
    if (timeElement) {
        const seconds = Math.floor(game.getElapsedTime() / 1000);
        timeElement.textContent = `Time: ${seconds}s`;
    }

    // Update FPS display
    const fpsElement = document.getElementById('fps');
    if (fpsElement) {
        const fps = gameLoop.fps;
        fpsElement.textContent = `FPS: ${fps} | Ticks: ${game.getTickCount()}`;
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
        const status = game.getStatus();
        if (status === 'NOT_STARTED') {
            statusElement.textContent = 'Press SPACE to start';
            statusElement.style.display = 'block';
        } else if (status === 'GAME_OVER') {
            statusElement.textContent = `Game Over! Score: ${game.getScore()}. Press SPACE to restart`;
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
