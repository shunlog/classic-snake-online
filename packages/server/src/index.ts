import { WebSocketServer, WebSocket } from 'ws';
import { ServerLogic, ClientID, generateClientID, ServerMessage } from '@snake/shared';
import { z } from 'zod';

const PORT = 3000;
const TICK_RATE = 100; // ms per tick

const connections = new Map<ClientID, WebSocket>();

function sendToClient(connId: ClientID, message: ServerMessage): void {
    const ws = connections.get(connId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

const server = new ServerLogic(sendToClient);

// Message validation schemas
const DirectionSchema = z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT']);

const JoinMessageSchema = z.object({
    type: z.literal('join'),
    name: z.string().min(1).max(20)
});

const ReadyMessageSchema = z.object({
    type: z.literal('ready')
});

const InputMessageSchema = z.object({
    type: z.literal('input'),
    direction: DirectionSchema,
    tickCount: z.number()
});

const ClientMessageSchema = z.discriminatedUnion('type', [
    JoinMessageSchema,
    ReadyMessageSchema,
    InputMessageSchema
]);

// Game tick loop
let tickInterval: NodeJS.Timeout | null = null;
let countdownInterval: NodeJS.Timeout | null = null;

function startGameLoop() {
    if (tickInterval) return;
    
    tickInterval = setInterval(() => {
        if (server.getStatus() === 'PLAYING') {
            server.tick();
        }
    }, TICK_RATE);
    console.log('Game loop started');
}

function stopGameLoop() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
        console.log('Game loop stopped');
    }
}

function startCountdownLoop() {
    if (countdownInterval) return;
    
    countdownInterval = setInterval(() => {
        if (server.getStatus() === 'COUNTDOWN') {
            server.countdownTick();
            // When countdown finishes, start the game loop
            if (server.getStatus() === 'PLAYING') {
                stopCountdownLoop();
                startGameLoop();
            }
        } else {
            stopCountdownLoop();
        }
    }, 1000);
    console.log('Countdown started');
}

function stopCountdownLoop() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        console.log('Countdown stopped');
    }
}

const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws: WebSocket) => {
    const connId = generateClientID();
    connections.set(connId, ws);
    console.log('Client connected:', connId);

    ws.on('message', (data: Buffer) => {
        try {
            const parsed = JSON.parse(data.toString());
            const result = ClientMessageSchema.safeParse(parsed);
            
            if (!result.success) {
                console.error('Invalid message:', result.error);
                return;
            }
            
            server.handleMessage(connId, result.data);
            
            // Start countdown loop when players are ready
            if (result.data.type === 'ready' && server.getStatus() === 'COUNTDOWN') {
                startCountdownLoop();
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('Client disconnected:', connId);
        server.handleDisconnect(connId);
        connections.delete(connId);
        
        // Stop game loop if no players left
        if (connections.size < 2) {
            stopGameLoop();
        }
    });
});
