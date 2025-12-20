/**
 * WebSocket server for the Snake game.
 * Manages client connections and game state using commands.
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer } from 'ws';
import { SnakeGame, Direction } from './snake.js';
import { handleDirectionInput, handleTick, handleNewGame } from './commands.js';

const PORT = process.env.PORT || 8080;
const __dirname = path.resolve();

const server = http.createServer((req: any, res: any) => {
  if (req.url === '/') {
    const indexPath = path.join(__dirname, '../client/index.html');
    fs.readFile(indexPath, (err: any, data: any) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/client.js') {
    const clientPath = path.join(__dirname, '../client/client.js');
    fs.readFile(clientPath, (err: any, data: any) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading client.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server });

interface GameConnection {
  game: SnakeGame;
  tickInterval?: any;
}

const games = new Map<any, GameConnection>();

wss.on('connection', (ws: any) => {
  const conn: GameConnection = { game: handleNewGame() };
  games.set(ws, conn);

  // Send initial game state
  ws.send(
    JSON.stringify({ type: 'gameState', data: conn.game.serialize() })
  );

  // Start game tick loop (100ms per tick = ~10 FPS)
  conn.tickInterval = setInterval(() => {
    conn.game = handleTick(conn.game);
    ws.send(
      JSON.stringify({ type: 'gameState', data: conn.game.serialize() })
    );
  }, 100);

  ws.on('message', (message: string) => {
    const conn = games.get(ws);
    if (!conn) return;

    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'direction':
          conn.game = handleDirectionInput(conn.game, msg.direction as Direction);
          break;
        case 'newGame':
          conn.game = handleNewGame();
          ws.send(
            JSON.stringify({ type: 'gameState', data: conn.game.serialize() })
          );
          break;
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    const conn = games.get(ws);
    if (conn && conn.tickInterval) {
      clearInterval(conn.tickInterval);
    }
    games.delete(ws);
  });

  ws.on('error', (err: any) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`Snake server listening on http://localhost:${PORT}`);
});
