/**
 * Main game loop and rendering
 * 
 * This module orchestrates the game by:
 * - Managing the game loop
 * - Handling user input
 * - Rendering to HTML canvas
 */

import { SnakeGame, Direction, GameOverError, ClientMessage, ServerMessage, PlayerInfo } from '@snake/shared';
import { GameLoop } from './gameLoop.js';
import { draw, initDraw } from './draw.js';

export type GameStatus = 'NOT_STARTED' | 'PLAYING' | 'GAME_OVER';

const SNAKE_LENGTH = 4;
const SNAKE_TICK = 0.2;

let dtAcc = 0;
let status: GameStatus = 'NOT_STARTED';
let ws: WebSocket | null = null;
let players: PlayerInfo[] = [];
let myPlayerId: string | null = null;

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

function init(): void {
    initDraw();
    gameLoop.start();
    connectWebSocket();
}

function connectWebSocket(): void {
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected to server');
        updateConnectionStatus('Connected');
        const joinMessage: ClientMessage = {
            type: 'join',
            name: 'Player-' + Math.floor(Math.random() * 1000)
        };
        ws?.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        handleServerMessage(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('Error');
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        updateConnectionStatus('Disconnected');
    };
}

function handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
        case 'joined':
            console.log('Joined as', message.playerId);
            myPlayerId = message.playerId;
            break;
        case 'players':
            console.log('Players:', message.players);
            players = message.players;
            updatePlayersUI();
            break;
        case 'game_start':
            console.log('Game starting');
            break;
        case 'tick':
            break;
    }
}

function updateConnectionStatus(status: string): void {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function updatePlayersUI(): void {
    const playersListElement = document.getElementById('playersList');
    if (!playersListElement) {
        console.log('playersList element not found');
        return;
    }

    if (players.length === 0) {
        playersListElement.innerHTML = '<li>Waiting for players...</li>';
        return;
    }

    playersListElement.innerHTML = players
        .map(player => {
            const isMe = player.id === myPlayerId;
            const className = isMe ? 'me' : '';
            const suffix = isMe ? ' (You)' : '';
            return `<li class="${className}">${player.name}${suffix}</li>`;
        })
        .join('');
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

