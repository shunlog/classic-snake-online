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
import { draw, updatePlayersUI } from './draw.js';
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
        client.onConnect();
    };

    ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        client.handleMessage(message);
        updatePlayersUI(client.getPlayers(), client.getMyPlayerId());
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

