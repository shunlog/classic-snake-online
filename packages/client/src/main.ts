import { ClientLogic, ClientMessage, Direction, SnakeGameDTO, ClientStatus } from '@snake/shared';
import { parseServerMessage } from './validation';

const WS_URL = 'ws://localhost:3000';
const CELL_SIZE = 15; // Smaller cells for split screen
const TICK_RATE = 200; // ms per tick

// DOM Elements
const joinScreen = document.getElementById('join-screen')!;
const lobbyScreen = document.getElementById('lobby-screen')!;
const gameScreen = document.getElementById('game-screen')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const connectionStatus = document.getElementById('connection-status')!;
const playersList = document.getElementById('players-list')!;
const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
const lobbyStatus = document.getElementById('lobby-status')!;
const tickEl = document.getElementById('tick')!;
const gameOverlay = document.getElementById('game-overlay')!;
const overlayText = document.getElementById('overlay-text')!;

// Split screen elements
const playerCanvas = document.getElementById('player-canvas') as HTMLCanvasElement;
const opponentCanvas = document.getElementById('opponent-canvas') as HTMLCanvasElement;
const playerCtx = playerCanvas.getContext('2d')!;
const opponentCtx = opponentCanvas.getContext('2d')!;
const playerScoreEl = document.getElementById('player-score')!;
const opponentScoreEl = document.getElementById('opponent-score')!;

let ws: WebSocket | null = null;
let clientLogic: ClientLogic | null = null;
let gameLoopId: number | null = null;
let lastStatus: ClientStatus = 'CHOOSING_NAME';

function showScreen(screen: 'join' | 'lobby' | 'game') {
    joinScreen.classList.toggle('hidden', screen !== 'join');
    lobbyScreen.classList.toggle('hidden', screen !== 'lobby');
    gameScreen.classList.toggle('hidden', screen !== 'game');
}

function updateUI() {
    if (!clientLogic) return;

    const status = clientLogic.getStatus();

    // Handle screen transitions
    if (status !== lastStatus) {
        switch (status) {
            case 'CHOOSING_NAME':
                showScreen('join');
                break;
            case 'NOT_READY':
            case 'READY':
            case 'WAITING':
                showScreen('lobby');
                break;
            case 'COUNTDOWN':
            case 'PLAYING':
            case 'RESULTS_COUNTDOWN':
                showScreen('game');
                if (status === 'PLAYING' && lastStatus !== 'PLAYING') {
                    startGameLoop();
                }
                break;
        }
        lastStatus = status;
    }

    // Update lobby
    if (status === 'NOT_READY' || status === 'READY' || status === 'WAITING') {
        const clients = clientLogic.getClients();
        playersList.innerHTML = clients
            .map(c => `<li>${c.name}${c.ready ? ' ✓' : ''}</li>`)
            .join('');
        
        // Update ready button state
        readyBtn.disabled = status !== 'NOT_READY';
        if (status === 'NOT_READY') {
            lobbyStatus.textContent = 'Press Ready when you want to play!';
        } else if (status === 'READY') {
            lobbyStatus.textContent = 'Waiting for other player to be ready...';
        }
    }

    // Update countdown
    if (status === 'COUNTDOWN') {
        const countdown = clientLogic.getCountdown();
        lobbyStatus.textContent = `Game starting in ${countdown}...`;
        // Show countdown overlay on game screen
        gameOverlay.classList.remove('hidden');
        overlayText.textContent = countdown.toString();
        overlayText.className = 'countdown';
    }

    // Update game
    if (status === 'PLAYING') {
        // Hide overlay when playing
        gameOverlay.classList.add('hidden');
        const playerState = clientLogic.getGameState();
        const opponentState = clientLogic.getOpponentState();
        
        if (playerState) {
            playerScoreEl.textContent = `Score: ${playerState.score}`;
            tickEl.textContent = `Tick: ${playerState.tickCount}`;
            renderGame(playerCtx, playerState, '#4ecca3');
        }
        if (opponentState) {
            opponentScoreEl.textContent = `Score: ${opponentState.score}`;
            renderGame(opponentCtx, opponentState, '#e74c3c');
        }
    }

    // Handle game over
    if (status === 'RESULTS_COUNTDOWN') {
        const winner = clientLogic.getWinner();
        const myId = clientLogic.getClientId();
        const resultsCountdown = clientLogic.getResultsCountdown();
        
        // Show game over overlay
        gameOverlay.classList.remove('hidden');
        if (winner === myId) {
            overlayText.innerHTML = `🎉 You Won! 🎉<br><span class="countdown-small">Next game in ${resultsCountdown}s</span>`;
            overlayText.className = 'winner';
            lobbyStatus.textContent = 'You won! 🎉';
        } else if (winner === null) {
            overlayText.innerHTML = `Game Over!<br><span class="countdown-small">Next game in ${resultsCountdown}s</span>`;
            overlayText.className = 'loser';
            lobbyStatus.textContent = 'Game Over!';
        } else {
            overlayText.innerHTML = `😢 You Lost! 😢<br><span class="countdown-small">Next game in ${resultsCountdown}s</span>`;
            overlayText.className = 'loser';
            lobbyStatus.textContent = 'You lost! 😢';
        }
        stopGameLoop();
    }
}

function renderGame(ctx: CanvasRenderingContext2D, state: SnakeGameDTO, snakeColor: string) {
    const { gridWidth, gridHeight, snake, food } = state;
    const canvas = ctx.canvas;

    // Clear canvas
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, gridHeight * CELL_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(gridWidth * CELL_SIZE, y * CELL_SIZE);
        ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
        if (index === 0) {
            // Head - use snakeColor
            ctx.fillStyle = snakeColor;
        } else {
            // Body gradient - parse snakeColor for alpha effect
            ctx.fillStyle = snakeColor;
            ctx.globalAlpha = 1 - (index / snake.length) * 0.5;
        }
        ctx.fillRect(
            segment.x * CELL_SIZE + 1,
            segment.y * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
        );
        ctx.globalAlpha = 1;
    });
}

function startGameLoop() {
    if (gameLoopId) {
        clearInterval(gameLoopId);
    }
    gameLoopId = window.setInterval(() => {
        if (clientLogic && clientLogic.getStatus() === 'PLAYING') {
            clientLogic.tick();
            updateUI();
        }
    }, TICK_RATE);
}

function stopGameLoop() {
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
}

function sendMessage(message: ClientMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function connect() {
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.className = 'status-connecting';
    joinBtn.disabled = true;

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        connectionStatus.textContent = 'Connected!';
        connectionStatus.className = 'status-connected';
        joinBtn.disabled = false;
        
        clientLogic = new ClientLogic(sendMessage);
        updateUI();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const message = parseServerMessage(data);
        
        if (message && clientLogic) {
            clientLogic.handleMessage(message);
            updateUI();
        }
    };

    ws.onclose = () => {
        connectionStatus.textContent = 'Disconnected. Reconnecting...';
        connectionStatus.className = 'status-disconnected';
        joinBtn.disabled = true;
        stopGameLoop();
        
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
    };

    ws.onerror = () => {
        connectionStatus.textContent = 'Connection error';
        connectionStatus.className = 'status-disconnected';
    };
}

// Event Listeners
joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name && clientLogic) {
        clientLogic.joinServer(name);
    }
});

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

readyBtn.addEventListener('click', () => {
    if (clientLogic) {
        sendMessage({ type: 'ready' });
        readyBtn.disabled = true;
        lobbyStatus.textContent = 'Waiting for other player...';
    }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!clientLogic || clientLogic.getStatus() !== 'PLAYING') return;

    let direction: Direction | null = null;
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            direction = 'UP';
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            direction = 'DOWN';
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            direction = 'LEFT';
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            direction = 'RIGHT';
            break;
    }

    if (direction) {
        e.preventDefault();
        clientLogic.handleDirectionInput(direction);
        updateUI();
    }
});

// Start connection
connect();
