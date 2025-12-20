# Copilot Instructions for Classic Snake Online

## Architecture Overview

This is a **minimalist WebSocket-based Snake game** following **MIT 6.102 principles**: immutable Abstract Data Types (ADT), invariant checking, and formal specifications.

### Three-Layer Architecture

1. **SnakeGame ADT** (`src/server/snake.ts`, 358 lines)
   - Immutable, self-contained game logic
   - All state changes return new instances
   - 9 invariants checked by `checkRep()` after every operation
   - No side effects; pure functional design

2. **Commands** (`src/server/commands.ts`, 30 lines)
   - Thin 1-line wrappers: `handleTick()`, `handleDirectionInput()`, `handleNewGame()`
   - Server **always** calls commands, never ADT methods directly
   - Enables logging, validation, and future middleware

3. **WebSocket Server** (`src/server/server.ts`, 110 lines)
   - HTTP server for static assets + WebSocket for game sync
   - Per-connection `GameConnection` with 100ms tick intervals
   - JSON protocol: direction input → gameState output

### Client Layer

- **Vanilla JS** (`src/client/client.js`): keyboard handling, rendering, WebSocket communication
- **HTML** (`src/client/index.html`): 400×400 canvas, score display, minimal styling
- **Zero frontend dependencies** by design

---

## Critical Patterns


### Invariant Checking

Every SnakeGame operation ends with `checkRep()` validation:
- If ANY invariant fails → throws immediately (fail-fast design)

### Command-Only Access Pattern

**Server.ts rule**: All game changes go through commands, not direct method calls.

```typescript
// ✅ In server.ts, use commands:
conn.game = handleTick(conn.game);
conn.game = handleDirectionInput(conn.game, direction);

// ❌ Never bypass commands in server logic:
conn.game = conn.game.tick();  // Avoid this in server!
```

---

## Build & Run Workflow

```bash
npm install                # First time only
npm run build             # TypeScript → dist/
npm start                 # Run on PORT (default 8080)
PORT=3000 npm start       # Custom port

# Development (auto-rebuild):
npm run dev
```

### TypeScript Configuration
- **Target/Module**: ES2020 (modern modules with `import`/`export`)
- **Strict mode**: enabled
- **Import extensions**: **Must include `.js`** in server files (`import ... from './snake.js'`)
- Client files (`.js`) are served as-is; no TypeScript compilation


## Extending the Codebase

### Adding a Feature (e.g., obstacles)

1. **Update SnakeGame ADT** (`snake.ts`):
   - Add obstacle position array to `GameState`
   - Add invariant: "obstacles never on snake"
   - Update `checkRep()` to validate obstacles
   - Update collision detection in `tick()`
   - Update `serialize()` to include obstacles

2. **Update Commands** (`commands.ts`):
   - No changes needed (commands just wrap ADT methods)

3. **Update Server** (`server.ts`):
   - No changes needed (server already broadcasts serialized state)

4. **Update Client** (`client.js`):
   - Add rendering loop to draw obstacles


## Code Style & Conventions

- **Specifications**: Every public method has JSDoc with inputs/outputs/guarantees
- **Naming**: `get*()` for queries, `handle*()` for commands, `check*()` for validation
- **Error handling**: `checkRep()` throws on invariant violation (fail-fast)
- **Types**: Strict TypeScript; use interfaces for data (e.g., `Position`, `GameState`)

