/**
 * Client class for managing game state and server communication
 * Client statuses:
 * - CHOOSING_NAME: client opened website and has to pick a name
 * - NOT_READY: client picked name and clicked "join", now seeing the game if it's on
 * - READY: client pressed "ready"
 * - WAITING: client was ready and was picked to play next, waiting for game start
 * - COUNTDOWN: game is about to start, countdown is shown
 * - PLAYING: client is playing the game
 * - RESULTS_COUNTDOWN: game ended, results are shown for a few seconds
 */

import { SnakeGame, SnakeGameDTO, Direction } from './snake';
import { ClientMessage, ServerMessage, ClientInfo } from './messages';
import { MultiplayerClient, InputPacket, StatePacket } from './multiplayer';

const INITIAL_SNAKE_LENGTH = 4;

export type ClientStatus = 'CHOOSING_NAME' | 'NOT_READY' | 'READY' | 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';

/** Input type for snake game (re-exported from serverLogic) */
type SnakeInput = Direction;

export class ClientLogic {
    private status: ClientStatus = 'CHOOSING_NAME';
    private clients: ClientInfo[] = [];
    private _clientId: string | null = null;
    private sendMessage: (message: ClientMessage) => void;
    private countdown: number = 0;
    private winner: string | null = null;

    // Multiplayer game state (only active during PLAYING)
    private multiplayer: MultiplayerClient<SnakeGameDTO, SnakeInput> | null = null;

    private checkRep(): void {
        // If playing, multiplayer must exist
        if (this.status === 'PLAYING' && this.multiplayer === null) {
            throw new Error('Invariant violation: multiplayer must exist when PLAYING');
        }
    }

    constructor(sendMessage: (message: ClientMessage) => void) {
        this.sendMessage = sendMessage;
        this.checkRep();
    }

    joinServer(name: string): void {
        if (this.status !== 'CHOOSING_NAME') {
            return;
        }
        const joinMessage: ClientMessage = {
            type: 'join',
            name: name
        };
        this.sendMessage(joinMessage);
    }

    /**
     * Handle incoming server messages
     */
    handleMessage(message: ServerMessage): void {
        switch (message.type) {
            case 'joined':
                console.log('Joined as', message.clientId);
                this._clientId = message.clientId;
                this.status = 'NOT_READY';
                break;
            case 'clients':
                console.log('Clients:', message.clients);
                this.clients = message.clients;
                // Update status based on our ready state
                const me = this.clients.find(c => c.clientId === this._clientId);
                if (me && me.ready && this.status === 'NOT_READY') {
                    this.status = 'READY';
                }
                // If we were in RESULTS_COUNTDOWN and server shows us as not ready, go back to NOT_READY
                if (me && !me.ready && this.status === 'RESULTS_COUNTDOWN') {
                    this.status = 'NOT_READY';
                }
                break;
            case 'countdown':
                this.countdown = message.secondsRemaining;
                this.status = 'COUNTDOWN';
                break;
            case 'game_start':
                this.startGame(message.playerState);
                break;
            case 'tick':
                if (this.multiplayer) {
                    this.multiplayer.onServerState({
                        tick: message.tickCount,
                        lastProcessedInputId: message.tickCount, // Server uses tick as input ID
                        state: message.playerState
                    });
                }
                break;
            case 'game_over':
                this.winner = message.winner;
                this.status = 'RESULTS_COUNTDOWN';
                this.multiplayer = null;
                break;
        }
        this.checkRep();
    }

    /**
     * Handle a state packet from multiplayer server
     */
    handleStatePacket(packet: StatePacket<SnakeGameDTO>): void {
        if (this.multiplayer) {
            this.multiplayer.onServerState(packet);
        }
        this.checkRep();
    }

    private startGame(initialState: SnakeGameDTO): void {
        this.multiplayer = new MultiplayerClient<SnakeGameDTO, SnakeInput>(
            initialState,
            (packet) => this.sendInputPacket(packet),
            (state, input) => this.applyInput(state, input),
            (state) => this.simulate(state),
            (state) => this.cloneState(state)
        );
        this.status = 'PLAYING';
    }

    private sendInputPacket(packet: InputPacket<SnakeInput>): void {
        this.sendMessage({
            type: 'input',
            direction: packet.payload,
            tickCount: packet.tick
        });
    }

    private applyInput(state: SnakeGameDTO, input: SnakeInput): void {
        // Apply direction to queued direction
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

    tick(): void {
        if (this.status !== 'PLAYING' || !this.multiplayer) {
            return;
        }
        this.multiplayer.tick();
    }

    handleDirectionInput(direction: Direction): void {
        if (this.status !== 'PLAYING' || !this.multiplayer) {
            return;
        }
        this.multiplayer.input(direction);
    }

    resetGame(): void {
        this.multiplayer = null;
        this.status = 'NOT_READY';
    }

    // Getters
    getGame(): SnakeGame {
        if (this.multiplayer) {
            return SnakeGame.fromDTO(this.multiplayer.getState());
        }
        return new SnakeGame(20, 20, INITIAL_SNAKE_LENGTH);
    }

    getGameState(): SnakeGameDTO | null {
        return this.multiplayer?.getState() ?? null;
    }

    getStatus(): ClientStatus {
        return this.status;
    }

    getClients(): ClientInfo[] {
        return this.clients;
    }

    getPendingInputCount(): number {
        return this.multiplayer?.getPendingInputCount() ?? 0;
    }

    getCountdown(): number {
        return this.countdown;
    }

    getWinner(): string | null {
        return this.winner;
    }

    getClientId(): string | null {
        return this._clientId;
    }
}