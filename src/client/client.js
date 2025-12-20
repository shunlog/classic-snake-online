/**
 * Minimalist Snake Game Client
 * Communicates with server via WebSocket
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('newGameBtn');

const CELL_SIZE = 20;
const GRID_SIZE = 20;
const PORT = 8080; // Ensure this matches server port

let ws;
let gameState = null;
let nextDirection = null;

// Connect to server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.hostname}:${PORT}`);

  console.log('WebSocket connection initiated', ws);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'gameState') {
      gameState = msg.data;
      render();
    }
  };

  ws.onerror = () => {
    statusEl.textContent = 'Connection error';
  };

  ws.onclose = () => {
    statusEl.textContent = 'Disconnected - Refreshing...';
    setTimeout(() => location.reload(), 2000);
  };
}

// Handle keyboard input
document.addEventListener('keydown', (e) => {
  if (!gameState) return;
  
  const key = e.key.toLowerCase();
  const directionMap = {
    arrowup: 'UP',
    'w': 'UP',
    arrowdown: 'DOWN',
    's': 'DOWN',
    arrowleft: 'LEFT',
    'a': 'LEFT',
    arrowright: 'RIGHT',
    'd': 'RIGHT'
  };

  if (key in directionMap) {
    const newDir = directionMap[key];
    if (nextDirection !== newDir) {
      nextDirection = newDir;
      ws.send(JSON.stringify({ type: 'direction', direction: newDir }));
    }
    e.preventDefault();
  }
});

// Handle new game button
newGameBtn.addEventListener('click', () => {
  nextDirection = null;
  ws.send(JSON.stringify({ type: 'newGame' }));
});

// Render game state on canvas
function render() {
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(canvas.width, i * CELL_SIZE);
    ctx.stroke();
  }

  // Draw food
  ctx.fillStyle = '#f00';
  const food = gameState.food;
  ctx.fillRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

  // Draw snake
  gameState.snake.forEach((segment, idx) => {
    ctx.fillStyle = idx === 0 ? '#0f0' : '#0a0'; // Head is brighter
    ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  });

  // Update score
  scoreEl.textContent = `Score: ${gameState.score}`;

  // Update status
  if (gameState.isGameOver) {
    statusEl.textContent = 'Game Over! Click "New Game" to restart';
  } else {
    statusEl.textContent = '';
  }
}

// Initialize
connect();
