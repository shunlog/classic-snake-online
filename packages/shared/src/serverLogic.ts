/*
Server ADT
- uses a handleMessage method and callbacks to communicate with clients 
  rather than managing WebSocket connections directly
- has a tick() method
*/

import { ClientMessage, ServerMessage, ClientInfo, ClientsListMessage } from './messages';
import assert from 'assert';

export type ServerStatus = 'WAITING_PLAYERS' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';
export type ClientID = string;

const PLAYER_SLOTS = 2;

export function generateClientID(): ClientID {
    return Math.random().toString(36).substring(2, 15);
}

export class ServerLogic {
    // Clients are added as soon as they connect to the WebSocket server
    private clients = new Map<ClientID, ClientInfo>();
    // Players is a subset of `clients` who pressed "ready"
    private ready = new Set<ClientID>();
    // Players is a subset of `ready` that were selected to play next
    private players = new Set<ClientID>();
    private status: ServerStatus = 'WAITING_PLAYERS';
    private sendMessage: (clientId: ClientID, message: ServerMessage) => void;

    constructor(sendMessage: (clientId: ClientID, message: ServerMessage) => void) {
        this.sendMessage = sendMessage;
    }

    // Invariants:
    // - ready is a subset of clients' keys
    // - players is a subset of ready
    // - players.size <= PLAYER_SLOTS
    // - if status is PLAYING or COUNTDOWN, players.size === PLAYER_SLOTS

    private checkRep(): void {
        for (const id of this.ready) {
            assert(this.clients.has(id), 'All ready must be in `clients` map');
        }
        for (const id of this.players) {
            assert(this.ready.has(id), 'All players must be in `ready` set');
        }
        assert(this.players.size <= PLAYER_SLOTS, 'Players playing length must not exceed PLAYER_SLOTS');
        if (this.status === 'PLAYING' || this.status === 'COUNTDOWN') {
            assert(this.players.size === PLAYER_SLOTS, 'Must have exactly PLAYER_SLOTS players when playing');
        }
    }

    /**
     * Handle incoming client messages
     */
    handleMessage(clientId: ClientID, message: ClientMessage): void {
        switch (message.type) {
            case 'join':
                this.handleJoin(clientId, message.name);
                break;
            case 'input':
                this.handleInput(clientId, message);
                break;
        }
        this.checkRep();
    }

    /**
     * Handle client disconnection
     */
    handleDisconnect(clientId: ClientID): void {
        if (this.players.has(clientId)) {
            this.players.delete(clientId);

            if (this.status === 'PLAYING') {
                this.gameOver();
            }
        }

        console.log('Client disconnected');
        this.clients.delete(clientId);
        this.broadcastClientsList();
        this.checkRep();
    }

    private handleJoin(clientId: ClientID, name: string): void {
        const client: ClientInfo = { clientId: clientId, name };
        this.clients.set(clientId, client);

        const joinedMessage: ServerMessage = {
            type: 'joined',
            clientId,
            name
        };
        this.sendMessage(clientId, joinedMessage);
        this.broadcastClientsList();
    }

    private handleInput(_connId: ClientID, message: ClientMessage & { type: 'input' }): void {
        console.log('Received input:', message.direction, 'at tick', message.tickCount);
    }

    private broadcastMessage(message: ServerMessage): void {
        this.clients.forEach((_, id) => {
            this.sendMessage(id, message);
        });
    }

    private broadcastClientsList(): void {
        const msg: ClientsListMessage = {
            type: 'clients',
            clients: Array.from(this.clients.values())
        };
        this.broadcastMessage(msg);
    }

    private gameOver(): void {
        this.status = 'RESULTS_COUNTDOWN';
        this.checkRep();
    }

    // Getters
    getStatus(): ServerStatus {
        return this.status;
    }

    getPlayerCount(): number {
        return this.players.size;
    }
    
    getClientCount(): number {
        return this.clients.size;
    }
}