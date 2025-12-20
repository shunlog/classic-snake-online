/**
 * Immutable SnakeGame ADT for managing snake game state and logic.
 * 
 * Invariants:
 * - snake array is never empty (always has at least the head)
 * - all snake segments are within bounds [0, gridSize)
 * - no two snake segments occupy the same position
 * - food is always at a valid position [0, gridSize)
 * - food is never on the same position as any snake segment
 * - direction is one of: 'UP', 'DOWN', 'LEFT', 'RIGHT'
 * - isGameOver is true iff the snake has collided with itself or the boundaries
 */

export interface Position {
  readonly x: number;
  readonly y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface GameState {
  snake: Position[];
  direction: Direction;
  nextDirection: Direction;
  food: Position;
  isGameOver: boolean;
  score: number;
}

export class SnakeGame {
  private readonly state: GameState;
  private readonly gridSize = 20;

  /**
   * Creates a new SnakeGame with initial state.
   * Snake starts at center, food at random location.
   */
  constructor() {
    const center = Math.floor(20 / 2);
    this.state = {
      snake: [{ x: center, y: center }],
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      food: this.generateFood([{ x: center, y: center }]),
      isGameOver: false,
      score: 0
    };
    this.checkRep();
  }

  /**
   * Factory method to create a SnakeGame with specific state.
   */
  static createFromState(state: GameState): SnakeGame {
    const game = new SnakeGame();
    (game as any).state = state;
    game.checkRep();
    return game;
  }

  /**
   * Sets the next direction the snake will move.
   * Prevents 180-degree turns (cannot turn directly opposite to current direction).
   * 
   * @param newDirection the desired direction to move
   * @returns a new SnakeGame with the next direction set, or this if invalid
   */
  public setDirection(newDirection: Direction): SnakeGame {
    const opposite: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT'
    };

    if (opposite[this.state.direction] === newDirection && this.state.nextDirection === this.state.direction) {
      return this;
    }

    const newState: GameState = {
      ...this.state,
      nextDirection: newDirection
    };
    return SnakeGame.createFromState(newState);
  }

  /**
   * Advances the game state by one tick.
   * Moves the snake in the current direction, checks for collisions and food consumption.
   * 
   * @returns a new SnakeGame with the advanced state
   */
  public tick(): SnakeGame {
    if (this.state.isGameOver) {
      return this;
    }

    const newHead = this.moveHead();

    // Check collisions
    if (!this.isInBounds(newHead) || this.isSnakeBody(newHead)) {
      const newState: GameState = {
        ...this.state,
        direction: this.state.nextDirection,
        isGameOver: true
      };
      return SnakeGame.createFromState(newState);
    }

    let newSnake = [newHead, ...this.state.snake];
    let newFood = this.state.food;
    let newScore = this.state.score;

    // Check food consumption
    if (newHead.x === this.state.food.x && newHead.y === this.state.food.y) {
      newFood = this.generateFood(newSnake);
      newScore += 10;
    } else {
      newSnake = newSnake.slice(0, -1);
    }

    const newState: GameState = {
      snake: newSnake,
      direction: this.state.nextDirection,
      nextDirection: this.state.nextDirection,
      food: newFood,
      isGameOver: false,
      score: newScore
    };
    return SnakeGame.createFromState(newState);
  }

  /**
   * Returns the current snake segments.
   * 
   * @returns array of positions from head to tail
   */
  public getSnake(): readonly Position[] {
    return [...this.state.snake];
  }

  /**
   * Returns the current food position.
   * 
   * @returns the food position
   */
  public getFood(): Position {
    return { ...this.state.food };
  }

  /**
   * Returns the current direction the snake is moving.
   * 
   * @returns the current direction
   */
  public getDirection(): Direction {
    return this.state.direction;
  }

  /**
   * Returns the next direction the snake will move.
   * 
   * @returns the next direction
   */
  public getNextDirection(): Direction {
    return this.state.nextDirection;
  }

  /**
   * Returns whether the game is over.
   * 
   * @returns true if the snake has collided, false otherwise
   */
  public getIsGameOver(): boolean {
    return this.state.isGameOver;
  }

  /**
   * Returns the current score.
   * 
   * @returns the score (10 points per food eaten)
   */
  public getScore(): number {
    return this.state.score;
  }

  /**
   * Returns the grid size.
   * 
   * @returns the size of the game grid
   */
  public getGridSize(): number {
    return this.gridSize;
  }

  /**
   * Returns the game state as a serializable object.
   * 
   * @returns game state object suitable for transmission over network
   */
  public serialize() {
    return {
      snake: this.state.snake,
      food: this.state.food,
      direction: this.state.direction,
      isGameOver: this.state.isGameOver,
      score: this.state.score,
      gridSize: this.gridSize
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Generates a new food position not occupied by the snake.
   * 
   * @param snake optional snake to avoid (uses this.state.snake if not provided)
   * @returns a random valid position for food
   */
  private generateFood(snake: Position[] = this.state.snake): Position {
    while (true) {
      const food: Position = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize)
      };
      if (!this.isSnakeBody(food, snake)) {
        return food;
      }
    }
  }

  /**
   * Static version of generateFood for use in constructor.
   */
  private static generateFoodStatic(gridSize: number, snake: Position[]): Position {
    while (true) {
      const food: Position = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
      if (!snake.some(segment => segment.x === food.x && segment.y === food.y)) {
        return food;
      }
    }
  }

  /**
   * Calculates the new head position based on the next direction.
   */
  private moveHead(): Position {
    const head = this.state.snake[0];
    const directionDelta: Record<Direction, { dx: number; dy: number }> = {
      UP: { dx: 0, dy: -1 },
      DOWN: { dx: 0, dy: 1 },
      LEFT: { dx: -1, dy: 0 },
      RIGHT: { dx: 1, dy: 0 }
    };

    const delta = directionDelta[this.state.nextDirection];
    return {
      x: head.x + delta.dx,
      y: head.y + delta.dy
    };
  }

  /**
   * Checks if a position is within grid bounds.
   */
  private isInBounds(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.gridSize && pos.y >= 0 && pos.y < this.gridSize;
  }

  /**
   * Checks if a position is occupied by the snake body.
   * 
   * @param pos the position to check
   * @param snake optional snake to check against (uses this.state.snake if not provided)
   */
  private isSnakeBody(pos: Position, snake: Position[] = this.state.snake): boolean {
    return snake.some(segment => segment.x === pos.x && segment.y === pos.y);
  }

  /**
   * Checks the class invariants. Called after every state change.
   * 
   * @throws Error if any invariant is violated
   */
  private checkRep(): void {
    // Snake is never empty
    if (this.state.snake.length === 0) {
      throw new Error('Invariant violated: snake cannot be empty');
    }

    // All snake segments are within bounds
    for (const segment of this.state.snake) {
      if (segment.x < 0 || segment.x >= 20 || segment.y < 0 || segment.y >= 20) {
        throw new Error('Invariant violated: snake segment out of bounds');
      }
    }

    // No two snake segments occupy the same position
    const seen = new Set<string>();
    for (const segment of this.state.snake) {
      const key = `${segment.x},${segment.y}`;
      if (seen.has(key)) {
        throw new Error('Invariant violated: snake segments overlap');
      }
      seen.add(key);
    }

    // Food is at a valid position
    if (this.state.food.x < 0 || this.state.food.x >= 20 || this.state.food.y < 0 || this.state.food.y >= 20) {
      throw new Error('Invariant violated: food out of bounds');
    }

    // Food is not on snake
    if (this.isSnakeBody(this.state.food)) {
      throw new Error('Invariant violated: food on snake');
    }

    // Direction is valid
    const validDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    if (!validDirections.includes(this.state.direction)) {
      throw new Error('Invariant violated: invalid direction');
    }
    if (!validDirections.includes(this.state.nextDirection)) {
      throw new Error('Invariant violated: invalid next direction');
    }
  }
}

/**
 * Helper class to access private constructor.
 * This is a workaround to allow the ADT to use a private constructor pattern.
 */
class SnakeGame_Private extends SnakeGame {
  constructor(
    snake: Position[],
    direction: Direction,
    nextDirection: Direction,
    food: Position,
    isGameOver: boolean,
    score: number
  ) {
    super();
    Object.assign(this, {
      snake,
      direction,
      nextDirection,
      food,
      isGameOver,
      score,
      gridSize: 20
    });
    (this as any).checkRep();
  }
}
