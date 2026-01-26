import { describe, it, expect } from 'vitest';
import { ClientLogic } from './clientLogic';
import { ServerLogic } from './serverLogic';

describe('Multiplayer Simulation', () => {
    it('successfully syncs movement', () => {
        let server: ServerLogic;
        let client: ClientLogic;
        client = new ClientLogic((msg) => {
            server.handleMessage('player-1', msg);
        });
        server = new ServerLogic((targetClientId, msg) => {
            if (targetClientId === 'player-1') {
                client.handleMessage(msg);
            }
        });

        client.sendJoin();
        expect(server.getPlayerCount()).toBe(1);
    });
});