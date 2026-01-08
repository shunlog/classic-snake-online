import { Client } from '@snake/client';
import { Server, ConnID } from '@snake/server';
import { ClientMessage, ServerMessage } from '@snake/shared';

describe('Client-Server Integration', () => {
    test('clients join server', () => {
        const connId: ConnID = 'conn1';

        const client = new Client((message: ClientMessage) => {
            server.handleMessage(connId, message);
        });

        const server = new Server((connId: ConnID, message: ServerMessage) => {
            client.handleMessage(message);
        });

        client.onConnect();
        expect(server.getPlayerCount()).toBe(1);

        const client2 = new Client((message: ClientMessage) => {
            server.handleMessage(connId, message);
        });

        client2.onConnect();
        expect(server.getPlayerCount()).toBe(2);
        expect(server.getStatus()).toBe('COUNTDOWN');
    });
});
