/**
 * WebSocket message types for client-server communication
 * All messages follow a discriminated union pattern for type safety
 */

import { SnakeGameDTO, Direction } from "./snake";

/**
 * Messages from client to server
 */
export type ClientMessage =
  | JoinMessage
  | ReadyMessage
  | InputMessage;

/**
 * Client sends ready status
 */
export interface ReadyMessage {
  type: 'ready';
}

/**
 * Client sends a direction input at a specific local tick
 */
export interface InputMessage {
  type: 'input';
  direction: Direction;
  tickCount: number;
}

/**
 * Messages from server to client
 */
export type ServerMessage =
  | JoinedMessage
  | ClientsListMessage
  | CountdownMessage
  | GameStartMessage
  | TickMessage
  | GameOverMessage;

/**
 * Client requests to join the lobby
 */
export interface JoinMessage {
  type: 'join';
  name: string;
}

/**
 * Server confirms client has joined
 */
export interface JoinedMessage {
  type: 'joined';
  clientId: string;
  name: string;
}


/**
 * Client information
 */
export interface ClientInfo {
  clientId: string;
  name: string;
  ready: boolean;
}

/**
 * Server sends updated list of clients
 */
export interface ClientsListMessage {
  type: 'clients';
  clients: ClientInfo[];
}

/**
 * Server sends countdown before game starts
 */
export interface CountdownMessage {
  type: 'countdown';
  secondsRemaining: number;
}

export interface GameStartMessage {
  type: 'game_start';
  startTimeMs: number; // in reference to client's performance.now()
  playerState: SnakeGameDTO;
  opponentState: SnakeGameDTO;
}

/**
 * Game tick synchronization (bidirectional)
 */
export interface TickMessage {
  type: 'tick';
  tickCount: number;
  playerState: SnakeGameDTO;
  opponentState: SnakeGameDTO;
}

/**
 * Server notifies game ended
 */
export interface GameOverMessage {
  type: 'game_over';
  winner: string | null; // clientId of winner, null if draw
}