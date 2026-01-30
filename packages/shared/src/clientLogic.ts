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

import { SnakeGame, Direction } from './snake';
import { ClientMessage, ServerMessage, InputMessage, ClientInfo } from './messages';

const INITIAL_SNAKE_LENGTH = 4;

export type ClientStatus = 'CHOOSING_NAME' | 'NOT_READY' | 'READY' | 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';

export class ClientLogic {
    private game: SnakeGame;
    private dtAcc: number = 0;
    private status: ClientStatus = 'CHOOSING_NAME';
    private clients: ClientInfo[] = [];
    private clientId: string | null = null;
    // message callback
    private sendMessage: (message: ClientMessage) => void;

    // Invariants:
    private checkRep(): void {

    }

    constructor(sendMessage: (message: ClientMessage) => void) {
        this.sendMessage = sendMessage;
        this.game = new SnakeGame(20, 20, INITIAL_SNAKE_LENGTH);
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
                this.clientId = message.clientId;
                this.status = 'NOT_READY';
                break;
            case 'clients':
                console.log('Clients:', message.clients);
                this.clients = message.clients;
                break;
            case 'game_start':
                this.game = SnakeGame.fromDTO(message.playerState);
                this.status = 'PLAYING';
                break;
            case 'tick':
                this.game = SnakeGame.fromDTO(message.playerState);
                break;
        }
        this.checkRep();
    }

    tick(): void {
        if (this.status !== 'PLAYING') {
            return;
        }
    }

    handleDirectionInput(direction: Direction): void {
        if (this.status !== 'PLAYING') {
            return;
        }

        const inputMessage: InputMessage = {
            type: 'input',
            direction: direction,
            tickCount: this.game.getTickCount()
        };
        this.sendMessage(inputMessage);
    }

    resetGame(): void {
        this.game = new SnakeGame(20, 20, INITIAL_SNAKE_LENGTH);
        this.dtAcc = 0;
    }

    // Getters
    getGame(): SnakeGame {
        return this.game;
    }

    getStatus(): ClientStatus {
        return this.status;
    }

    getClients(): ClientInfo[] {
        return this.clients;
    }
}