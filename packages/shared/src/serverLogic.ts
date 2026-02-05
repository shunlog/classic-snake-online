/*
Server ADT
- uses a handleMessage method and callbacks to communicate with clients 
  rather than managing WebSocket connections directly
- has a tick() method
*/

import { SnakeGame, SnakeGameDTO, Direction } from './snake';
import { ClientMessage, ServerMessage, ClientInfo, ClientsListMessage } from './messages';
import { MultiplayerServer, InputPacket, StatePacket } from './multiplayer';
import assert from 'assert';

export type ServerStatus = 'WAITING_PLAYERS' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';
export type ClientID = string;

const PLAYER_SLOTS = 2;
const INITIAL_SNAKE_LENGTH = 4;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;

/** Input type for snake game */
export type SnakeInput = Direction;

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

    // Multiplayer game instances for each player (only during PLAYING)
    private playerGames = new Map<ClientID, MultiplayerServer<SnakeGameDTO, SnakeInput>>();

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
     * Handle an input packet directly (for multiplayer integration)
     */
    handleInputPacket(clientId: ClientID, packet: InputPacket<SnakeInput>): void {
        const playerGame = this.playerGames.get(clientId);
        if (playerGame) {
            playerGame.onClientInput(packet);
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
        this.playerGames.delete(clientId);
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

    private handleInput(clientId: ClientID, message: ClientMessage & { type: 'input' }): void {
        const playerGame = this.playerGames.get(clientId);
        if (playerGame) {
            playerGame.onClientInput({
                tick: message.tickCount,
                inputId: message.tickCount, // Use tickCount as inputId for simplicity
                payload: message.direction
            });
        }
    }

    /**
     * Start a game between two players
     */
    startGame(player1Id: ClientID, player2Id: ClientID): void {
        this.players.clear();
        this.players.add(player1Id);
        this.players.add(player2Id);
        this.ready.add(player1Id);
        this.ready.add(player2Id);
        this.status = 'PLAYING';

        // Create initial states for each player
        const game1 = new SnakeGame(GRID_WIDTH, GRID_HEIGHT, INITIAL_SNAKE_LENGTH);
        const game2 = new SnakeGame(GRID_WIDTH, GRID_HEIGHT, INITIAL_SNAKE_LENGTH);
        const state1 = game1.toDTO();
        const state2 = game2.toDTO();

        // Create multiplayer servers for each player
        this.playerGames.set(player1Id, new MultiplayerServer<SnakeGameDTO, SnakeInput>(
            state1,
            (packet) => this.sendStateToClient(player1Id, packet),
            (state, input) => this.applyInput(state, input),
            (state) => this.simulate(state),
            (state) => this.cloneState(state)
        ));

        this.playerGames.set(player2Id, new MultiplayerServer<SnakeGameDTO, SnakeInput>(
            state2,
            (packet) => this.sendStateToClient(player2Id, packet),
            (state, input) => this.applyInput(state, input),
            (state) => this.simulate(state),
            (state) => this.cloneState(state)
        ));

        // Send game_start to both players
        this.sendMessage(player1Id, {
            type: 'game_start',
            startTimeMs: Date.now(),
            playerState: state1,
            opponentState: state2
        });

        this.sendMessage(player2Id, {
            type: 'game_start',
            startTimeMs: Date.now(),
            playerState: state2,
            opponentState: state1
        });

        this.checkRep();
    }

    private sendStateToClient(clientId: ClientID, packet: StatePacket<SnakeGameDTO>): void {
        // Get opponent state
        let opponentState: SnakeGameDTO | null = null;
        for (const [id, game] of this.playerGames) {
            if (id !== clientId) {
                opponentState = game.getState();
                break;
            }
        }

        this.sendMessage(clientId, {
            type: 'tick',
            tickCount: packet.tick,
            playerState: packet.state,
            opponentState: opponentState ?? packet.state
        });
    }

    private applyInput(state: SnakeGameDTO, input: SnakeInput): void {
        const game = SnakeGame.fromDTO(state);
        if (game.canQueueDirection(input)) {
            game.queueDirection(input);
        }
        Object.assign(state, game.toDTO());
    }

    private simulate(state: SnakeGameDTO): void {
        const game = SnakeGame.fromDTO(state);
        game.tick();
        Object.assign(state, game.toDTO());
    }

    private cloneState(state: SnakeGameDTO): SnakeGameDTO {
        return {
            snake: state.snake.map(p => ({ x: p.x, y: p.y })),
            food: { x: state.food.x, y: state.food.y },
            direction: state.direction,
            queuedDir1: state.queuedDir1,
            queuedDir2: state.queuedDir2,
            score: state.score,
            gridWidth: state.gridWidth,
            gridHeight: state.gridHeight,
            startTime: state.startTime,
            elapsedTime: state.elapsedTime,
            tickCount: state.tickCount
        };
    }

    /**
     * Advance all player games by one tick
     */
    tick(): void {
        if (this.status !== 'PLAYING') {
            return;
        }
        for (const playerGame of this.playerGames.values()) {
            playerGame.tick();
        }
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
        this.playerGames.clear();
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

    getPlayerState(clientId: ClientID): SnakeGameDTO | null {
        return this.playerGames.get(clientId)?.getState() ?? null;
    }
}