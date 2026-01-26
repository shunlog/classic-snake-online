import { WebSocketServer, WebSocket } from 'ws';
import { ServerLogic, ClientID, generateClientID, ClientMessage, ServerMessage }
    from '@snake/shared';

const PORT = 3000;

const connections = new Map<ClientID, WebSocket>();

function sendToClient(connId: ClientID, message: ServerMessage): void {
    const ws = connections.get(connId);
    if (ws) {
        ws.send(JSON.stringify(message));
    }
}

const server = new ServerLogic(sendToClient);

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server running on ws://localhost:${PORT}`);
wss.on('connection', (ws: WebSocket) => {
    const connId = generateClientID();
    connections.set(connId, ws);
    console.log('Client connected');

    ws.on('message', (data: Buffer) => {
        // TODO: validate message structure
        const message: ClientMessage = JSON.parse(data.toString());
        server.handleMessage(connId, message);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        server.handleDisconnect(connId);
        connections.delete(connId);
    });
});
