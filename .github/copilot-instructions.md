# Copilot Instructions for Classic Snake Online

First of all, don't write verbose markdown files. Keep it short and to the point.
Only provide instructions on how to quickly run the project locally.
Don't explain anything that an experienced developer can figure out on his own.

## Architecture Overview

This is a **minimalist browser-based Snake game** following **MIT 6.102 principles**: immutable Abstract Data Types (ADT), invariant checking, and formal specifications.

### Three-Layer Architecture

1. **SnakeGame ADT** (`src/snake.ts`)
   - Immutable, self-contained game logic
   - All state changes return new instances
   - 10 invariants checked by `checkRep()` after every operation
   - No side effects; pure functional design

2. **Commands** (`src/commands.ts`)
   - Thin 1-line wrappers: `tick()`, `queueDirection()`, `newGame()`, `restart()`, `start()`
   - Main **always** calls commands, never ADT methods directly
   - Enables logging, validation, and future middleware

3. **Main Loop** (`src/main.ts`)
   - Canvas rendering and game loop
   - Keyboard input handling
   - **Only calls command functions, never SnakeGame methods directly**

### Test Layer

- **Unit tests** (`test/snake.test.ts`): 37 tests covering all public methods and invariants

---

## Critical Patterns

### Invariant Checking

Every SnakeGame operation ends with `checkRep()` validation:
- If ANY invariant fails → throws immediately (fail-fast design)

### Command-Only Access Pattern

**main.ts rule**: All game changes go through commands, not direct method calls.

```typescript
// ✅ In main.ts, use commands:
game = tick(game);
game = queueDirection(game, direction);
const state = getState(game);

// ❌ Never bypass commands in main.ts:
game = game.tick();  // Avoid this!
const state = game.serialize();  // Avoid this!
```

---

## Build & Run Workflow

```bash
npm install                # First time only
npm run build             # TypeScript → dist/
python3 -m http.server 8080  # Serve from root

# Run tests:
npm test
```

### TypeScript Configuration
- **Target/Module**: ES2020 (modern modules with `import`/`export`)
- **Strict mode**: enabled
- **Import extensions**: **Must include `.js`** in imports (`import ... from './snake.js'`)

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

3. **Update Main** (`main.ts`):
   - Update rendering to draw obstacles
   - Use command functions only

4. **Update Tests** (`test/snake.test.ts`):
   - Add tests for obstacle-related functionality


## Code Style & Conventions

- **Specifications**: Every public method has JSDoc with inputs/outputs/guarantees
- **Naming**: `get*()` for queries, `handle*()` for commands, `check*()` for validation
- **Error handling**: `checkRep()` throws on invariant violation (fail-fast)
- **Types**: Strict TypeScript; use interfaces for data (e.g., `Position`, `GameState`)

