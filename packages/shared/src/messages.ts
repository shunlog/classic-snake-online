/**
 * WebSocket message types for client-server communication
 * All messages follow a discriminated union pattern for type safety
 */

import { SnakeGame } from "./snake";

/**
 * Player information
 */
export interface PlayerInfo {
  id: string;
  name: string;
}

/**
 * Messages from client to server
 */
export type ClientMessage =
  | JoinMessage;

/**
 * Messages from server to client
 */
export type ServerMessage =
  | JoinedMessage
  | PlayersListMessage
  | GameStartMessage
  | TickMessage
  | ErrorMessage;

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
 * Server sends updated list of players
 */
export interface PlayersListMessage {
  type: 'players';
  players: PlayerInfo[];
}

export interface GameStartMessage {
  type: 'game_start';
  playerState: SnakeGame;
  opponentState: SnakeGame;
}

/**
 * Game tick synchronization (bidirectional)
 */
export interface TickMessage {
  type: 'tick';
  tickCount: number;
  playerState: SnakeGame;
  opponentState: SnakeGame;
}

/**
 * Server error message
 */
export interface ErrorMessage {
  type: 'error';
  message: string;
}
