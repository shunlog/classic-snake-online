import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, ServerMessage, PlayerInfo } from '@snake/shared';

const PORT = 3000;

const wss = new WebSocketServer({ port: PORT });

const clients = new Map<WebSocket, PlayerInfo>();

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    ws.on('message', (data: Buffer) => {
        try {
            const message: ClientMessage = JSON.parse(data.toString());
            handleClientMessage(ws, message);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
        broadcastPlayersList();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleClientMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
        case 'join':
            handleJoin(ws, message.name);
            break;
        case 'input':
            handleInput(ws, message);
            break;
    }
}

function handleJoin(ws: WebSocket, name: string): void {
    const playerId = generatePlayerId();
    const playerInfo: PlayerInfo = { id: playerId, name };
    clients.set(ws, playerInfo);

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

function broadcastPlayersList(): void {
    const players = Array.from(clients.values());
    console.log('Broadcasting players list:', players);
    const playersMessage: ServerMessage = {
        type: 'players',
        players
    };
    const messageStr = JSON.stringify(playersMessage);
    clients.forEach((_, ws) => {
        ws.send(messageStr);
    });
}

function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 11);
}

