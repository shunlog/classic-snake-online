/**
 * Server class for managing game state and client connections
 */

import { ClientMessage, ServerMessage, PlayerInfo, PlayersListMessage } from '@snake/shared';
import assert from 'assert';

export type ServerStatus = 'WAITING_PLAYERS' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';
export type ConnID = string;

const PLAYER_SLOTS = 2;

export function generateConnId(): ConnID {
    return Math.random().toString(36).substring(2, 15);
}

export class Server {
    private clients = new Map<ConnID, PlayerInfo>();
    private players = new Array<ConnID>();
    private status: ServerStatus = 'WAITING_PLAYERS';
    private sendToClient: (connId: ConnID, message: ServerMessage) => void;

    // Invariants:
    // - players is a subset of clients' keys
    // - players.length <= PLAYER_SLOTS
    // - if status is PLAYING or COUNTDOWN, players.length === PLAYER_SLOTS

    constructor(sendToClient: (connId: ConnID, message: ServerMessage) => void) {
        this.sendToClient = sendToClient;
    }

    private checkRep(): void {
        assert(this.players.every(connId => this.clients.has(connId)), 'All players must be in clients map');
        assert(this.players.length <= PLAYER_SLOTS, 'Players length must not exceed PLAYER_SLOTS');
        if (this.status === 'PLAYING' || this.status === 'COUNTDOWN') {
            assert(this.players.length === PLAYER_SLOTS, 'Must have exactly PLAYER_SLOTS players when playing');
        }
    }

    /**
     * Handle incoming client messages
     */
    handleMessage(connId: ConnID, message: ClientMessage): void {
        switch (message.type) {
            case 'join':
                this.handleJoin(connId, message.name);
                break;
            case 'input':
                this.handleInput(connId, message);
                break;
        }
        this.checkRep();
    }

    /**
     * Handle client disconnection
     */
    handleClose(connId: ConnID): void {
        if (this.players.includes(connId)) {
            this.players.splice(this.players.indexOf(connId), 1);

            if (this.status === 'PLAYING') {
                this.gameOver();
            }
        }

        console.log('Client disconnected');
        this.clients.delete(connId);
        this.broadcastPlayersList();
        this.checkRep();
    }

    private handleJoin(connId: ConnID, name: string): void {
        const playerId = this.generatePlayerId();
        const playerInfo: PlayerInfo = { id: playerId, name };
        this.clients.set(connId, playerInfo);

        if (this.players.length < PLAYER_SLOTS) {
            this.players.push(connId);
        }

        const joinedMessage: ServerMessage = {
            type: 'joined',
            playerId,
            name
        };
        this.sendToClient(connId, joinedMessage);
        this.broadcastPlayersList();
    }

    private handleInput(_connId: ConnID, message: ClientMessage & { type: 'input' }): void {
        console.log('Received input:', message.direction, 'at tick', message.tickCount);
    }

    private broadcastMessage(message: ServerMessage): void {
        this.clients.forEach((_, connId) => {
            this.sendToClient(connId, message);
        });
    }

    private broadcastPlayersList(): void {
        const players_infos = this.players.map(connId => this.clients.get(connId)!);
        const playersMessage: PlayersListMessage = {
            type: 'players',
            players: players_infos
        };
        this.broadcastMessage(playersMessage);
    }

    private gameOver(): void {
        this.status = 'RESULTS_COUNTDOWN';
        this.checkRep();
    }

    private generatePlayerId(): string {
        return Math.random().toString(36).substring(2, 11);
    }

    // Getters
    getStatus(): ServerStatus {
        return this.status;
    }

    getPlayerCount(): number {
        return this.players.length;
    }
}
