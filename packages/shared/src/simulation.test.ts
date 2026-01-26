import { describe, it, expect } from 'vitest';
import { ClientLogic } from './clientLogic';
import { ServerLogic } from './serverLogic';

describe('Clients join Server', () => {
    it('client joins', () => {
        let server: ServerLogic;
        let client1 = new ClientLogic((msg) => {
            server.handleMessage('player-1', msg);
        });
        let client2 = new ClientLogic((msg) => {
            server.handleMessage('player-2', msg);
        });
        server = new ServerLogic((targetClientId, msg) => {
            if (targetClientId === 'player-1') {
                client1.handleMessage(msg);
            } else if (targetClientId === 'player-2') {
                client2.handleMessage(msg);
            }
        });

        client1.joinServer();
        expect(server.getClientCount()).toBe(1);

        client2.joinServer();
        expect(server.getClientCount()).toBe(2);
    });

});