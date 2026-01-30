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

    it('client joins', () => {
        client1.joinServer('Alice');
        expect(server.getClientCount()).toBe(1);

        client2.joinServer('Bob');
        expect(server.getClientCount()).toBe(2);

        expect(client1.getStatus()).toBe('NOT_READY');
        expect(client2.getStatus()).toBe('NOT_READY');
    });

    it('server starts game when enough players are ready', () => {
        client1.joinServer('Alice');
        client2.joinServer('Bob');
    });
});