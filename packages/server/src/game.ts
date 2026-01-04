/**
 * Game session management for the Classic Snake WebSocket server
 */

import type {
  ClientMessage,
  ServerMessage,
  JoinedMessage,
  PlayersListMessage,
  ErrorMessage,
  TickMessage
} from '@snake/shared';

const MAX_PLAYERS = 2;
// average latency + some slack
// represents how much later the server ticks than the client.
// Inputs for a tick should be received before this time.
const CUTOFF_TIME_MS = 150;
let tickCount = 0;

export type SendMessage = (message: ServerMessage) => void;

export class InvalidClientMessageError extends Error {
  readonly originalError: unknown;

  constructor(originalError: unknown) {
    super('Invalid client message payload');
    this.name = 'InvalidClientMessageError';
    this.originalError = originalError;
  }
}

interface PlayerSession {
  id: string;
  name: string;
  send: SendMessage;
}

const players = new Map<string, PlayerSession>();

export function parseClientMessage(data: Buffer): ClientMessage {
  try {
    return JSON.parse(data.toString()) as ClientMessage;
  } catch (error) {
    throw new InvalidClientMessageError(error);
  }
}

export function handleTick(): void {
  tickCount += 1;

  const tickMessage: TickMessage = {
    type: 'tick',
    tickCount
  };

  players.forEach(player => {
    player.send(tickMessage);
  });
}

function broadcastPlayerList(): void {
  const playerList = Array.from(players.values()).map(player => ({
    id: player.id,
    name: player.name
  }));

  const message: PlayersListMessage = {
    type: 'players',
    players: playerList
  };

  players.forEach(player => {
    player.send(message);
  });
}

export function handleConnection(connectionId: string, sendMsg: SendMessage): boolean {
  if (players.size >= MAX_PLAYERS) {
    const errorMsg: ErrorMessage = { type: 'error', message: 'Lobby is full' };
    sendMsg(errorMsg);
    console.log('Connection rejected: lobby is full');
    return false;
  }

  console.log(`Connection ${connectionId} established.`);
  return true;
}

export function handleMessage(
  message: ClientMessage,
  connectionId: string,
  sendMsg: SendMessage
): void {
  switch (message.type) {
    case 'join': {
      const playerName = message.name || `Player ${players.size + 1}`;
      const player: PlayerSession = {
        id: connectionId,
        name: playerName,
        send: sendMsg
      };

      players.set(connectionId, player);
      console.log(`Player ${player.name} (${connectionId}) joined. Total players: ${players.size}`);

      const joinedMsg: JoinedMessage = {
        type: 'joined',
        playerId: connectionId,
        name: player.name
      };
      sendMsg(joinedMsg);

      broadcastPlayerList();
      break;
    }

    case 'tick':
      sendMsg(message);
      break;
  }
}

export function handleClose(connectionId: string): void {
  if (players.has(connectionId)) {
    const player = players.get(connectionId)!;
    players.delete(connectionId);
    console.log(`Player ${player.name} (${connectionId}) disconnected. Total players: ${players.size}`);

    broadcastPlayerList();
  }
}

export function handleError(connectionId: string): void {
  console.error(`WebSocket error on connection ${connectionId}`);
}
