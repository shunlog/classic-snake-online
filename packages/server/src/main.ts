import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, ServerMessage, PlayerInfo, PlayersListMessage } from '@snake/shared';
import assert from 'assert';

export type ServerStatus = 'WAITING_PLAYERS' | 'COUNTDOWN' |  'PLAYING' | 'RESULTS_COUNTDOWN';

const PLAYER_SLOTS = 2;
const PORT = 3000;

// Info about clients who sent a 'join' message, watching the game
const clients = new Map<WebSocket, PlayerInfo>();
// Players currently playing
const players = new Array<WebSocket>();
let status: ServerStatus = 'WAITING_PLAYERS';

// Invariants:
// - players is a subset of clients' keys
// - players.length <= PLAYER_SLOTS

function checkRep(): void {
    assert(players.every(ws => clients.has(ws)), 'All players must be in clients map');
    assert(players.length <= PLAYER_SLOTS, 'Players length must not exceed PLAYER_SLOTS');
    if (status === 'PLAYING' || status === 'COUNTDOWN') {
        assert(players.length === PLAYER_SLOTS);
    }
}

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server running on ws://localhost:${PORT}`);
wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');
    ws.on('message', (data: Buffer) => {
        // TODO: validate message structure
        const message: ClientMessage = JSON.parse(data.toString());
        handleMessage(ws, message);
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    ws.on('close', () => {
        handleClose(ws);
    });

});

function gameOver(): void {
    status = 'RESULTS_COUNTDOWN';
    checkRep();
}

function handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
        case 'join':
            handleJoin(ws, message.name);
            break;
        case 'input':
            handleInput(ws, message);
            break;
    }
    checkRep();
}

function handleClose(ws: WebSocket): void {
    if (players.includes(ws)) {
            players.splice(players.indexOf(ws), 1);

            if (status === 'PLAYING') {
                gameOver();
            }
        }

    console.log('Client disconnected');
    clients.delete(ws);
    broadcastPlayersList();
    checkRep();
}

// -- Helpers --

function handleJoin(ws: WebSocket, name: string): void {
    const playerId = generatePlayerId();
    const playerInfo: PlayerInfo = { id: playerId, name };
    clients.set(ws, playerInfo);

    if (players.length < PLAYER_SLOTS) {
        players.push(ws);
    }

    const joinedMessage: ServerMessage = {
        type: 'joined',
        playerId,
        name
    };
    ws.send(JSON.stringify(joinedMessage));
    broadcastPlayersList();
}

function handleInput(_ws: WebSocket, message: ClientMessage & { type: 'input' }): void {
    console.log('Received input:', message.direction, 'at tick', message.tickCount);
}

function broadcastMessage(message: ServerMessage): void {
    clients.forEach((_, ws) => {
        ws.send(JSON.stringify(message));
    });
}

function broadcastPlayersList(): void {
    const players_infos = players.map(ws => clients.get(ws)!);
    const playersMessage: PlayersListMessage = {
        type: 'players',
        players: players_infos
    };
    broadcastMessage(playersMessage);
}

function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 11);
}


