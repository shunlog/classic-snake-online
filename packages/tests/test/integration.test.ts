/**
 * Integration test for Client and Server communication
 * 
 * Simulates the interaction between Client and Server classes
 * by connecting them through their callbacks
 */

import { Client } from '@snake/client';
import { Server, ConnID } from '@snake/server';
import { ClientMessage, ServerMessage } from '@snake/shared';

describe('Client-Server Integration', () => {
    test('simulates basic client-server communication', () => {
        // Message queues to simulate network
        const serverMessages: Map<ConnID, ServerMessage[]> = new Map();
        const clientMessages: ClientMessage[] = [];

        let connId: ConnID;

        // Server callback - send message to client
        const serverSendToClient = (id: ConnID, message: ServerMessage) => {
            if (!serverMessages.has(id)) {
                serverMessages.set(id, []);
            }
            serverMessages.get(id)!.push(message);
        };

        // Client callback - send message to server
        const clientSendMessage = (message: ClientMessage) => {
            clientMessages.push(message);
        };

        // Create instances
        const server = new Server(serverSendToClient);
        const client = new Client(clientSendMessage);

        // Simulate connection
        connId = 'test-conn-123';

        // Client initiates join
        const joinMessage: ClientMessage = {
            type: 'join',
            name: 'TestPlayer'
        };
        server.handleMessage(connId, joinMessage);

        // Process server response
        expect(serverMessages.get(connId)?.length).toBe(2); // 'joined' + 'players'
        const joinedMsg = serverMessages.get(connId)![0];
        expect(joinedMsg.type).toBe('joined');
        if (joinedMsg.type === 'joined') {
            expect(joinedMsg.name).toBe('TestPlayer');
            expect(joinedMsg.playerId).toBeTruthy();
        }

        // Client receives joined message
        client.handleMessage(joinedMsg);
        expect(client.getMyPlayerId()).toBeTruthy();

        // Client receives players list
        const playersMsg = serverMessages.get(connId)![1];
        expect(playersMsg.type).toBe('players');
        client.handleMessage(playersMsg);
        expect(client.getPlayers().length).toBe(1);
        expect(client.getPlayers()[0].name).toBe('TestPlayer');

        // Simulate a second player joining
        const connId2 = 'test-conn-456';
        const joinMessage2: ClientMessage = {
            type: 'join',
            name: 'Player2'
        };
        server.handleMessage(connId2, joinMessage2);

        // Both clients should receive updated players list
        const playersUpdateMsg = serverMessages.get(connId)![2];
        expect(playersUpdateMsg.type).toBe('players');
        client.handleMessage(playersUpdateMsg);
        expect(client.getPlayers().length).toBe(2);

        // Simulate client sending input (though game not started yet)
        const inputMessage: ClientMessage = {
            type: 'input',
            direction: 'UP',
            tickCount: 1
        };
        clientMessages.length = 0; // Clear
        client.handleDirectionInput('UP');
        
        // Client should NOT send input when not playing
        expect(clientMessages.length).toBe(0);

        // Run a few update ticks
        client.update(0.1);
        client.update(0.1);
        client.update(0.1);
        
        // Client should remain in WATCHING status
        expect(client.getStatus()).toBe('WATCHING');
    });

    test('simulates client disconnection', () => {
        const serverMessages: Map<ConnID, ServerMessage[]> = new Map();

        const serverSendToClient = (id: ConnID, message: ServerMessage) => {
            if (!serverMessages.has(id)) {
                serverMessages.set(id, []);
            }
            serverMessages.get(id)!.push(message);
        };

        const server = new Server(serverSendToClient);

        // Connect two players
        const connId1 = 'conn-1';
        const connId2 = 'conn-2';

        server.handleMessage(connId1, { type: 'join', name: 'Player1' });
        server.handleMessage(connId2, { type: 'join', name: 'Player2' });

        expect(server.getPlayerCount()).toBe(2);

        // Disconnect first player
        server.handleClose(connId1);

        expect(server.getPlayerCount()).toBe(1);
        expect(server.getStatus()).toBe('WAITING_PLAYERS');
    });
});
