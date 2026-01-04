/**
 * Game session management for the Classic Snake WebSocket server
 */

import { performance } from 'node:perf_hooks';
import type {
    ClientMessage,
    ServerMessage,
    JoinedMessage,
    PlayersListMessage,
    ErrorMessage,
    //   TickMessage,
    TimeSyncRequestMessage,
    TimeSyncResponseMessage
} from '@snake/shared';

const MAX_PLAYERS = 2;
// average latency + some slack
// represents how much later the server ticks than the client.
// Inputs for a tick should be received before this time.
// const CUTOFF_TIME_MS = 150;
let tickCount = 0;
const TIME_SYNC_TIMEOUT_MS = 2000;

export type SendMessage = (message: ServerMessage) => void;

export class InvalidClientMessageError extends Error {
    readonly originalError: unknown;

    constructor(originalError: unknown) {
        super('Invalid client message payload');
        this.name = 'InvalidClientMessageError';
        this.originalError = originalError;
    }
}

interface PlayerSession {
    id: string;
    name: string;
    send: SendMessage;
}

const players = new Map<string, PlayerSession>();

interface PendingTimeSync {
    connectionId: string;
    startTime: number;
    resolve: (result: TimeSyncResult) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

const pendingTimeSync = new Map<string, PendingTimeSync>();

export interface TimeSyncResult {
    requestId: string;
    latencyMs: number;
    clientTimeMs: number;
}

export function parseClientMessage(data: Buffer): ClientMessage {
    try {
        return JSON.parse(data.toString()) as ClientMessage;
    } catch (error) {
        throw new InvalidClientMessageError(error);
    }
}

export function handleTick(): void {
    tickCount += 1;

    //   const tickMessage: TickMessage = {
    //     type: 'tick',
    //     tickCount
    //   };

    //   players.forEach(player => {
    //     player.send(tickMessage);
    //   });
}

export function requestTimeSync(connectionId: string): Promise<TimeSyncResult> {
    const player = players.get(connectionId);
    if (!player) {
        return Promise.reject(new Error(`No player for connection ${connectionId}`));
    }

    const requestId = generateRequestId(connectionId);
    const startTime = performance.now();
    const requestMessage: TimeSyncRequestMessage = {
        type: 'time_sync_request',
        requestId
    };

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            pendingTimeSync.delete(requestId);
            reject(new Error(`Time sync request ${requestId} timed out`));
        }, TIME_SYNC_TIMEOUT_MS);

        pendingTimeSync.set(requestId, {
            connectionId,
            startTime,
            resolve,
            reject,
            timeoutId
        });

        player.send(requestMessage);
    });
}

function generateRequestId(connectionId: string): string {
    return `${connectionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function broadcastPlayerList(): void {
    const playerList = Array.from(players.values()).map(player => ({
        id: player.id,
        name: player.name
    }));

    const message: PlayersListMessage = {
        type: 'players',
        players: playerList
    };

    players.forEach(player => {
        player.send(message);
    });
}

export function handleConnection(connectionId: string, sendMsg: SendMessage): boolean {
    if (players.size >= MAX_PLAYERS) {
        const errorMsg: ErrorMessage = { type: 'error', message: 'Lobby is full' };
        sendMsg(errorMsg);
        console.log('Connection rejected: lobby is full');
        return false;
    }

    console.log(`Connection ${connectionId} established.`);
    return true;
}

export async function handleMessage(
    message: ClientMessage,
    connectionId: string,
    sendMsg: SendMessage
): Promise<void> {
    switch (message.type) {
        case 'join': {
            const playerName = message.name || `Player ${players.size + 1}`;
            const player: PlayerSession = {
                id: connectionId,
                name: playerName,
                send: sendMsg
            };

            players.set(connectionId, player);
            console.log(`Player ${player.name} (${connectionId}) joined. Total players: ${players.size}`);

            const joinedMsg: JoinedMessage = {
                type: 'joined',
                playerId: connectionId,
                name: player.name
            };
            sendMsg(joinedMsg);

            broadcastPlayerList();

            try {
                let res = await requestTimeSync(connectionId)
                console.log(`Time sync result for ${connectionId}:`, res);
            } catch (error) {
                console.error(`Time sync failed for ${connectionId}:`, error);
            }

            break;
        }

        case 'time_sync_response':
            handleTimeSyncResponse(connectionId, message);
            break;
    }
}

function handleTimeSyncResponse(
    connectionId: string,
    message: TimeSyncResponseMessage
): void {
    const pending = pendingTimeSync.get(message.requestId);
    if (!pending || pending.connectionId !== connectionId) {
        return;
    }

    pendingTimeSync.delete(message.requestId);
    clearTimeout(pending.timeoutId);

    const latencyMs = performance.now() - pending.startTime;
    pending.resolve({
        requestId: message.requestId,
        latencyMs,
        clientTimeMs: message.clientTimeMs
    });
}

export function handleClose(connectionId: string): void {
    if (players.has(connectionId)) {
        const player = players.get(connectionId)!;
        players.delete(connectionId);
        console.log(`Player ${player.name} (${connectionId}) disconnected. Total players: ${players.size}`);

        broadcastPlayerList();
    }

    rejectPendingSyncs(connectionId, 'Connection closed');
}

export function handleError(connectionId: string): void {
    console.error(`WebSocket error on connection ${connectionId}`);
    rejectPendingSyncs(connectionId, 'Connection error');
}

function rejectPendingSyncs(connectionId: string, reason: string): void {
    pendingTimeSync.forEach((pending, requestId) => {
        if (pending.connectionId === connectionId) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(`${reason} before time sync completed`));
            pendingTimeSync.delete(requestId);
        }
    });
}
