import { describe, it, expect, beforeEach } from 'vitest';
import { ClientLogic } from './clientLogic';
import { ServerLogic } from './serverLogic';

describe('Clients and Server', () => {
    let server!: ServerLogic;
    let client1!: ClientLogic;
    let client2!: ClientLogic;

    beforeEach(() => {
        client1 = new ClientLogic((msg) => {
            server.handleMessage('player-1', msg);
        });
        client2 = new ClientLogic((msg) => {
            server.handleMessage('player-2', msg);
        });
        server = new ServerLogic((targetClientId, msg) => {
            if (targetClientId === 'player-1') {
                client1.handleMessage(msg);
            } else if (targetClientId === 'player-2') {
                client2.handleMessage(msg);
            }
        });
    });

    /** Helper to start game: join, ready, and run countdown */
    function startGameWithPlayers() {
        client1.joinServer('Alice');
        client2.joinServer('Bob');
        // Both players ready
        server.handleMessage('player-1', { type: 'ready' });
        server.handleMessage('player-2', { type: 'ready' });
        // Run countdown to completion
        server.countdownTick(); // 3 -> 2
        server.countdownTick(); // 2 -> 1
        server.countdownTick(); // 1 -> 0, starts game
    }

    it('client joins', () => {
        client1.joinServer('Alice');
        expect(server.getClientCount()).toBe(1);

        client2.joinServer('Bob');
        expect(server.getClientCount()).toBe(2);

        expect(client1.getStatus()).toBe('NOT_READY');
        expect(client2.getStatus()).toBe('NOT_READY');
    });

    it('server starts game and clients transition to PLAYING', () => {
        startGameWithPlayers();

        expect(server.getStatus()).toBe('PLAYING');
        expect(client1.getStatus()).toBe('PLAYING');
        expect(client2.getStatus()).toBe('PLAYING');
    });

    it('clients receive initial game state on game start', () => {
        startGameWithPlayers();

        const state1 = client1.getGameState();
        const state2 = client2.getGameState();

        expect(state1).not.toBeNull();
        expect(state2).not.toBeNull();
        expect(state1!.snake.length).toBe(4);
        expect(state2!.snake.length).toBe(4);
    });

    it('server tick advances game state and syncs clients', () => {
        startGameWithPlayers();

        const initialTick = client1.getGameState()!.tickCount;

        server.tick();

        const newState = client1.getGameState();
        expect(newState!.tickCount).toBe(initialTick + 1);
    });

    it('client input is applied with prediction', () => {
        startGameWithPlayers();

        const initialState = client1.getGameState()!;
        const initialDir = initialState.direction;

        // Initial direction is RIGHT, so UP is valid
        client1.handleDirectionInput('UP');

        // Client should have pending input
        expect(client1.getPendingInputCount()).toBe(1);

        // Client prediction: direction should be queued
        const predictedState = client1.getGameState()!;
        expect(predictedState.queuedDir1).toBe('UP');
    });

    it('server processes input and acknowledges to client', () => {
        startGameWithPlayers();

        client1.handleDirectionInput('UP');
        expect(client1.getPendingInputCount()).toBe(1);

        // Server tick processes input and sends state back
        server.tick();

        // Client should have reconciled, pending cleared
        expect(client1.getPendingInputCount()).toBe(0);
    });

    it('multiple inputs are processed correctly', () => {
        startGameWithPlayers();

        // Send UP, then LEFT (both valid from initial RIGHT direction)
        client1.handleDirectionInput('UP');
        client1.handleDirectionInput('LEFT');

        expect(client1.getPendingInputCount()).toBe(2);

        // After tick, both should be acknowledged
        server.tick();
        expect(client1.getPendingInputCount()).toBe(0);
    });

    it('game state evolves over multiple ticks', () => {
        startGameWithPlayers();

        const initialSnakeHead = client1.getGameState()!.snake[0];

        // Run several ticks
        server.tick();
        server.tick();
        server.tick();

        const finalSnakeHead = client1.getGameState()!.snake[0];

        // Snake should have moved (initial direction is RIGHT)
        expect(finalSnakeHead.x).toBeGreaterThan(initialSnakeHead.x);
    });

    it('both players can input simultaneously', () => {
        startGameWithPlayers();

        client1.handleDirectionInput('UP');
        client2.handleDirectionInput('DOWN');

        server.tick();

        // Both clients should be synchronized
        expect(client1.getPendingInputCount()).toBe(0);
        expect(client2.getPendingInputCount()).toBe(0);

        // Each player's state should reflect their own input
        expect(client1.getGameState()!.direction).toBe('UP');
        expect(client2.getGameState()!.direction).toBe('DOWN');
    });
});