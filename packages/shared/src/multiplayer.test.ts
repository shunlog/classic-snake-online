import { describe, it, expect, beforeEach } from 'vitest';
import {
    MultiplayerClient,
    MultiplayerServer,
    InputPacket,
    StatePacket,
} from './multiplayer';

/**
 * Example game state - a simple position-based game
 * This demonstrates how you would define your own game state
 */
interface GameState {
    x: number;
    y: number;
    velocity: number;
}

/**
 * Example input type - direction commands
 * This demonstrates how you would define your own input type
 */
type GameInput = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

/**
 * Example GameClient class showing how to compose MultiplayerClient
 * into your own game-specific client class
 */
class GameClient {
    private readonly multiplayer: MultiplayerClient<GameState, GameInput>;

    constructor(
        initialState: GameState,
        sendToServer: (packet: InputPacket<GameInput>) => void
    ) {
        this.multiplayer = new MultiplayerClient(
            initialState,
            sendToServer,
            this.applyInput.bind(this),
            this.simulate.bind(this),
            this.cloneState.bind(this)
        );
    }

    private applyInput(state: GameState, input: GameInput): void {
        switch (input) {
            case 'LEFT':
                state.x -= 1;
                break;
            case 'RIGHT':
                state.x += 1;
                break;
            case 'UP':
                state.y -= 1;
                break;
            case 'DOWN':
                state.y += 1;
                break;
        }
    }

    private simulate(state: GameState): void {
        // Move by velocity each tick
        state.x += state.velocity;
    }

    private cloneState(state: GameState): GameState {
        return { x: state.x, y: state.y, velocity: state.velocity };
    }

    public input(direction: GameInput): void {
        this.multiplayer.input(direction);
    }

    public tick(): void {
        this.multiplayer.tick();
    }

    public onServerState(packet: StatePacket<GameState>): void {
        this.multiplayer.onServerState(packet);
    }

    public getState(): GameState {
        return this.multiplayer.getState();
    }

    public getCurrentTick(): number {
        return this.multiplayer.getCurrentTick();
    }

    public getPendingInputCount(): number {
        return this.multiplayer.getPendingInputCount();
    }
}

/**
 * Example GameServer class showing how to compose MultiplayerServer
 * into your own game-specific server class
 */
class GameServer {
    private readonly multiplayer: MultiplayerServer<GameState, GameInput>;

    constructor(
        initialState: GameState,
        sendToClient: (packet: StatePacket<GameState>) => void
    ) {
        this.multiplayer = new MultiplayerServer(
            initialState,
            sendToClient,
            this.applyInput.bind(this),
            this.simulate.bind(this),
            this.cloneState.bind(this)
        );
    }

    private applyInput(state: GameState, input: GameInput): void {
        switch (input) {
            case 'LEFT':
                state.x -= 1;
                break;
            case 'RIGHT':
                state.x += 1;
                break;
            case 'UP':
                state.y -= 1;
                break;
            case 'DOWN':
                state.y += 1;
                break;
        }
    }

    private simulate(state: GameState): void {
        state.x += state.velocity;
    }

    private cloneState(state: GameState): GameState {
        return { x: state.x, y: state.y, velocity: state.velocity };
    }

    public onClientInput(packet: InputPacket<GameInput>): void {
        this.multiplayer.onClientInput(packet);
    }

    public tick(): void {
        this.multiplayer.tick();
    }

    public getState(): GameState {
        return this.multiplayer.getState();
    }

    public getCurrentTick(): number {
        return this.multiplayer.getCurrentTick();
    }
}

describe('Multiplayer Client-Server Integration', () => {
    const initialState: GameState = { x: 0, y: 0, velocity: 1 };

    let client: GameClient;
    let server: GameServer;

    beforeEach(() => {
        // Wire client and server together
        server = new GameServer(initialState, (packet) => {
            client.onServerState(packet);
        });

        client = new GameClient(initialState, (packet) => {
            server.onClientInput(packet);
        });
    });

    it('client predicts input immediately', () => {
        expect(client.getState().x).toBe(0);

        client.input('RIGHT');

        // Client applies immediately (prediction)
        expect(client.getState().x).toBe(1);
        expect(client.getPendingInputCount()).toBe(1);
    });

    it('server processes input on tick and acknowledges', () => {
        client.input('RIGHT');
        expect(client.getPendingInputCount()).toBe(1);

        // Server tick processes the input and sends state back
        server.tick();

        // Client received acknowledgment, pending cleared
        expect(client.getPendingInputCount()).toBe(0);
        expect(client.getState().x).toBe(2); // 1 (input) + 1 (velocity from simulate)
        expect(server.getState().x).toBe(2);
    });

    it('client and server stay synchronized over multiple ticks', () => {
        // Tick 0 -> 1: client inputs, server ticks
        client.input('RIGHT');
        server.tick();
        // After tick 1: x = 1(input) + 1(vel) = 2, y = 0

        expect(client.getCurrentTick()).toBe(1);
        expect(server.getCurrentTick()).toBe(1);
        expect(client.getState().x).toBe(2);

        // Tick 1 -> 2
        client.input('DOWN');
        server.tick();
        // After tick 2: x = 2 + 1(vel) = 3, y = 0 + 1(input) = 1

        expect(client.getCurrentTick()).toBe(2);
        expect(server.getCurrentTick()).toBe(2);
        expect(client.getState().x).toBe(3);
        expect(client.getState().y).toBe(1);
        expect(server.getState().x).toBe(3);
        expect(server.getState().y).toBe(1);
    });

    it('client reapplies pending inputs after server reconciliation', () => {
        // Client sends multiple inputs before server processes
        client.input('RIGHT');
        client.input('RIGHT');
        client.input('DOWN');

        expect(client.getState().x).toBe(2);
        expect(client.getState().y).toBe(1);
        expect(client.getPendingInputCount()).toBe(3);

        // Server processes first tick - all inputs queued for tick 0
        server.tick();

        // All inputs acknowledged, states match
        expect(client.getPendingInputCount()).toBe(0);
        expect(client.getState().x).toBe(3); // 2 rights + 1 velocity
        expect(client.getState().y).toBe(1);
        expect(server.getState().x).toBe(3);
    });

    it('late inputs are applied on current server tick', () => {
        // Advance server by a few ticks
        server.tick();
        server.tick();
        expect(server.getCurrentTick()).toBe(2);

        // Client is behind - sends input for tick 0
        client.input('RIGHT');

        // Server receives late input and applies it on current tick (2)
        server.tick();

        // Input was applied, state is synchronized
        expect(server.getState().x).toBe(4); // 3 velocity ticks + 1 input
    });

    it('demonstrates full game loop with interleaved inputs and ticks', () => {
        // Frame 1: Player presses RIGHT
        client.input('RIGHT');
        expect(client.getState().x).toBe(1); // Immediate prediction

        // Frame 2: Server processes (sends state back to client)
        server.tick();
        expect(client.getState().x).toBe(2); // server: 1(input) + 1(vel) = 2

        // Frame 3: Player presses LEFT twice
        client.input('LEFT');
        client.input('LEFT');
        expect(client.getState().x).toBe(0); // 2 - 2 = 0

        // Frame 4: Server processes
        server.tick();

        // Both should be at same position
        expect(client.getState().x).toBe(server.getState().x);
        expect(client.getState().x).toBe(1); // 2 - 2 + 1(vel) = 1
    });

    it('handles rapid input followed by server catch-up', () => {
        // Client sends 5 rapid inputs
        for (let i = 0; i < 5; i++) {
            client.input('RIGHT');
        }
        expect(client.getState().x).toBe(5);
        expect(client.getPendingInputCount()).toBe(5);

        // Server catches up
        server.tick();

        // All acknowledged
        expect(client.getPendingInputCount()).toBe(0);
        expect(server.getState().x).toBe(6); // 5 inputs + 1 velocity
        expect(client.getState().x).toBe(6);
    });
});

describe('Multiplayer with simulated network delay', () => {
    const initialState: GameState = { x: 0, y: 0, velocity: 0 };

    it('client maintains prediction during delayed acknowledgment', () => {
        // Simulate network: messages are queued
        const clientToServer: InputPacket<GameInput>[] = [];
        const serverToClient: StatePacket<GameState>[] = [];

        const server = new GameServer(initialState, (packet) => {
            serverToClient.push(packet);
        });

        const client = new GameClient(initialState, (packet) => {
            clientToServer.push(packet);
        });

        // Client sends input (goes to queue, not server yet)
        client.input('RIGHT');
        expect(client.getState().x).toBe(1);
        expect(clientToServer.length).toBe(1);

        // Client ticks locally (still no server response)
        client.tick();
        client.tick();
        expect(client.getState().x).toBe(1); // No velocity in this test

        // Now deliver messages to server
        for (const packet of clientToServer) {
            server.onClientInput(packet);
        }
        clientToServer.length = 0;

        // Server ticks
        server.tick();
        expect(serverToClient.length).toBe(1);

        // Deliver server response to client
        for (const packet of serverToClient) {
            client.onServerState(packet);
        }

        // Client reconciled to server state
        expect(client.getState().x).toBe(1);
        expect(client.getPendingInputCount()).toBe(0);
    });

    it('client reapplies unacknowledged inputs after delayed response', () => {
        const clientToServer: InputPacket<GameInput>[] = [];
        const serverToClient: StatePacket<GameState>[] = [];

        const server = new GameServer(initialState, (packet) => {
            serverToClient.push(packet);
        });

        const client = new GameClient(initialState, (packet) => {
            clientToServer.push(packet);
        });

        // Client sends input 0
        client.input('RIGHT');

        // Deliver to server
        server.onClientInput(clientToServer.shift()!);

        // Client sends input 1 before server responds
        client.input('RIGHT');
        expect(client.getState().x).toBe(2);
        expect(client.getPendingInputCount()).toBe(2);

        // Server ticks (only input 0 in queue)
        server.tick();

        // Deliver partial acknowledgment (only input 0)
        client.onServerState(serverToClient.shift()!);

        // Client has 1 pending input, reapplied on top of server state
        expect(client.getPendingInputCount()).toBe(1);
        expect(client.getState().x).toBe(2); // server x=1 + pending RIGHT

        // Deliver input 1 to server
        server.onClientInput(clientToServer.shift()!);

        // Server ticks again
        server.tick();
        client.onServerState(serverToClient.shift()!);

        // Fully synchronized
        expect(client.getPendingInputCount()).toBe(0);
        expect(client.getState().x).toBe(2);
        expect(server.getState().x).toBe(2);
    });
});
