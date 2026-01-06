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
  | InputMessage;
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
  | PlayersListMessage
  | GameStartMessage
  | TickMessage;

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
  playerId: string;
  name: string;
}


/**
 * Player information
 */
export interface PlayerInfo {
  id: string;
  name: string;
}

/**
 * Server sends updated list of players
 */
export interface PlayersListMessage {
  type: 'players';
  players: PlayerInfo[];
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
