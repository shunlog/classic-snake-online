/**
 * Client class for managing game state and server communication
 */

import { SnakeGame, Direction, ClientMessage, ServerMessage, InputMessage, PlayerInfo } from '@snake/shared';

const SNAKE_LENGTH = 4;
const SNAKE_TICK = 0.2;

export type ClientStatus = 'WATCHING' | 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS_COUNTDOWN';

export class Client {
    private game: SnakeGame;
    private dtAcc: number = 0;
    private status: ClientStatus = 'WATCHING';
    private players: PlayerInfo[] = [];
    private myPlayerId: string | null = null;
    private sendMessage: (message: ClientMessage) => void;

    constructor(sendMessage: (message: ClientMessage) => void) {
        this.sendMessage = sendMessage;
        this.game = new SnakeGame(20, 20, SNAKE_LENGTH);
    }

    /**
     * Handle incoming server messages
     */
    handleMessage(message: ServerMessage): void {
        switch (message.type) {
            case 'joined':
                console.log('Joined as', message.playerId);
                this.myPlayerId = message.playerId;
                break;
            case 'players':
                console.log('Players:', message.players);
                this.players = message.players;
                break;
            case 'game_start':
                this.game = SnakeGame.fromDTO(message.playerState);
                this.status = 'PLAYING';
                break;
            case 'tick':
                this.game = SnakeGame.fromDTO(message.playerState);
                break;
        }
    }

    /**
     * Update game state with client-side prediction (called with fixed timestep)
     */
    update(dt: number): void {
        if (this.status !== 'PLAYING') {
            return;
        }

        this.dtAcc += dt;
        if (this.dtAcc >= SNAKE_TICK) {
            try {
                this.game.tick();
            } catch (error) {
                console.log('Client predicts game over');
            }
            this.dtAcc -= SNAKE_TICK;
        }
    }

    /**
     * Handle direction input from player
     */
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

    /**
     * Reset the game state
     */
    resetGame(): void {
        this.game = new SnakeGame(20, 20, SNAKE_LENGTH);
        this.dtAcc = 0;
    }

    // Getters
    getGame(): SnakeGame {
        return this.game;
    }

    getStatus(): ClientStatus {
        return this.status;
    }

    getPlayers(): PlayerInfo[] {
        return this.players;
    }

    getMyPlayerId(): string | null {
        return this.myPlayerId;
    }
}
