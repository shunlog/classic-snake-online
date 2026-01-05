/**
 * Game session management for the Classic Snake WebSocket server
 */

import { performance } from 'node:perf_hooks';
import {
    type ClientMessage,
    type ServerMessage,
    type JoinedMessage,
    type PlayersListMessage,
    type ErrorMessage,
    type GameStartMessage,
    type TimeSyncRequestMessage,
    type TimeSyncResponseMessage,
    SnakeGame,
    GameStatus
} from '@snake/shared';

const MAX_PLAYERS = 2;
// average latency + some slack
// represents how much later the server ticks than the client.
// Inputs for a tick should be received before this time.
const CUTOFF_TIME_MS = 600;
let tickCount = 0;
let gameStatus : GameStatus = 'NOT_STARTED';
const TIME_SYNC_TIMEOUT_MS = 2000;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const INITIAL_SNAKE_LENGTH = 3;
const COUNTDOWN_MS = 3000;

export type SendMessage = (message: ServerMessage) => void;

export class InvalidClientMessageError extends Error {
    readonly originalError: unknown;

    constructor(originalError: unknown) {
        super('Invalid client message payload');
        this.name = 'InvalidClientMessageError';
        this.originalError = originalError;
    }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface PlayerSession {
    id: string;
    name: string;
    send: SendMessage;
}

const players = new Map<string, PlayerSession>();
const playerGames = new Map<string, SnakeGame>();
type QueuedInput = { tickCount: number; direction: import('@snake/shared').Direction };
const inputQueues = new Map<string, QueuedInput[]>();

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
    timeOffset: number;  // the ms difference: clientTime - serverTime
}

export function parseClientMessage(data: Buffer): ClientMessage {
    try {
        return JSON.parse(data.toString()) as ClientMessage;
    } catch (error) {
        throw new InvalidClientMessageError(error);
    }
}

export function handleTick(): void {
    if (gameStatus !== 'PLAYING') {
        return;
    }

    tickCount += 1;
    const sessions = [...players.values()];
    for (const player of sessions) {
        const game = playerGames.get(player.id);
        if (!game) continue;
        const queue = inputQueues.get(player.id) ?? [];
        // Apply inputs whose tickCount <= current server tick
        let i = 0;
        while (i < queue.length) {
            const input = queue[i];
            if (input.tickCount <= tickCount) {
                game.queueDirection(input.direction);
                queue.splice(i, 1);
            } else {
                i++;
            }
        }
        // Advance game by one tick
        game.tick();


        // Opponent mapping (assumes two players)
        const opponent = sessions.find(s => s.id !== player.id);
        const opponentGame = opponent ? playerGames.get(opponent.id)! : game;

        const tickMessage: import('@snake/shared').TickMessage = {
            type: 'tick',
            tickCount,
            playerState: game.toDTO(),
            opponentState: opponentGame.toDTO()
        };
        player.send(tickMessage);
    }
}

function gameOver(): void {
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

            if (players.size === MAX_PLAYERS) {
                startGame();
            }

            break;
        }

        case 'time_sync_response':
            handleTimeSyncResponse(connectionId, message);
            break;

        case 'input': {
            const queue = inputQueues.get(connectionId);
            if (message.tickCount <= tickCount) {
               // Ignore late input
               console.log(`Ignoring late input from ${connectionId} for tick ${message.tickCount} (current tick ${tickCount})`);
                break;
            }
            const entry = { tickCount: message.tickCount, direction: message.direction };
            if (!queue) {
                inputQueues.set(connectionId, [entry]);
            } else {
                queue.push(entry);
            }
            break;
        }
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
    const serverNow = performance.now();
    const timeOffset = message.clientTimeMs - serverNow + latencyMs / 2;
    pending.resolve({
        requestId: message.requestId,
        latencyMs,
        timeOffset
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


async function startGame(): Promise<void> {
    console.log('Both players connected. Starting countdown...');
    // Initialize per-player games and input queues
    playerGames.clear();
    inputQueues.clear();
    const initialGame = new SnakeGame(GRID_WIDTH, GRID_HEIGHT, INITIAL_SNAKE_LENGTH);

    const scheduledTime = performance.now() + COUNTDOWN_MS;
    for (const player of players.values()) {
        playerGames.set(player.id, SnakeGame.fromDTO(initialGame.toDTO()));
        inputQueues.set(player.id, []);
    }
    for (const player of players.values()) {
        let res = await requestTimeSync(player.id)
        console.log(`Time sync result for ${player.id}:`, res);
        const startTime =  scheduledTime + res.timeOffset - (res.latencyMs / 2);
        const opponent = [...players.values()].find(p => p.id !== player.id);
        const startMsg: GameStartMessage = {
            type: 'game_start',
            playerState: playerGames.get(player.id)!.toDTO(),
            opponentState: opponent ? playerGames.get(opponent.id)!.toDTO() : playerGames.get(player.id)!.toDTO(),
            startTimeMs: startTime
        };
        player.send(startMsg);
    }

    await sleep(scheduledTime - performance.now() + CUTOFF_TIME_MS);
    gameStatus = 'PLAYING';
    tickCount = 0;
    for (const player of players.values()) {
        playerGames.get(player.id)?.start();
    }
    console.log('Game started.');
}