/**
 * Main game loop and rendering
 * 
 * This module orchestrates the game by:
 * - Managing the game loop
 * - Handling user input
 * - Rendering to HTML canvas
 */

import { Direction, ClientMessage, ServerMessage } from '@snake/shared';
import { GameLoop } from './gameLoop.js';
import { draw } from './draw.js';
import { Client } from './client.js';

let ws: WebSocket | null = null;
let client: Client;


// Game loop instance
let gameLoop: GameLoop = new GameLoop({
    update: _update,
    render: _draw,
    handleInput: _handle_input
});

function init(): void {
    gameLoop.start();
    connectWebSocket();
}

function sendMessage(message: ClientMessage): void {
    ws?.send(JSON.stringify(message));
}

function connectWebSocket(): void {
    client = new Client(sendMessage);
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected to server');
        updateConnectionStatus('Connected');
        const joinMessage: ClientMessage = {
            type: 'join',
            name: 'Player-' + Math.floor(Math.random() * 1000)
        };
        sendMessage(joinMessage);
    };

    ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        client.handleMessage(message);
        updatePlayersUI();
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

    const players = client.getPlayers();
    const myPlayerId = client.getMyPlayerId();

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
        client.handleDirectionInput(direction);
    }
}

/**
 * Update game state (called with fixed timestep, in seconds)
 */
function _update(dt: number): void {
    client.update(dt);
}

function _draw(): void {
    draw(client.getGame(), gameLoop.fps, client.getStatus());
}

// Start the game when DOM is ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}

