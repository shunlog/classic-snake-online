/**
 * Classic Snake Game ADT (Abstract Data Type)
 * 
 * This immutable ADT represents the complete state and logic of a Snake game.
 * Following MIT 6.102 principles:
 * - Immutable design: all operations return new instances
 * - Representation invariants: checked after every operation
 * - No side effects: pure functional design
 * - Complete specifications for all public methods
 */

/**
 * Position on the game grid
 */
export interface Position {
    readonly x: number;
    readonly y: number;
}

/**
 * Direction of movement
 */
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/**
 * Game state enumeration
 */
export type GameStatus = 'NOT_STARTED' | 'PLAYING' | 'GAME_OVER';

/**
 * Complete game state (immutable)
 */
export interface GameState {
    readonly snake: ReadonlyArray<Position>;
    readonly food: Position;
    readonly direction: Direction;
    readonly inputQueue: ReadonlyArray<Direction>;
    readonly status: GameStatus;
    readonly score: number;
    readonly gridWidth: number;
    readonly gridHeight: number;
    readonly startTime: number;
    readonly elapsedTime: number;
}

/**
 * SnakeGame ADT - Immutable representation of Snake game logic
 * 
 * Abstraction Function:
 *   AF(snake, food, direction, inputQueue, status, score, gridWidth, gridHeight, startTime, elapsedTime) = 
 *     A Snake game where:
 *     - The snake occupies positions snake[0] (head), snake[1], ..., snake[n-1] (tail)
 *     - Food is located at position 'food'
 *     - Current movement direction is 'direction'
 *     - Pending direction changes are queued in 'inputQueue'
 *     - Game state is 'status' (NOT_STARTED, PLAYING, or GAME_OVER)
 *     - Player score is 'score' (initially 0, +10 per food eaten)
 *     - Grid dimensions are gridWidth × gridHeight
 *     - Game started at timestamp 'startTime', has been running for 'elapsedTime' ms
 * 
 * Representation Invariants:
 *   1. Snake has at least one segment (head)
 *   2. All snake positions are within grid bounds
 *   3. Food position is within grid bounds
 *   4. Food is not on any snake segment
 *   5. Grid dimensions are positive
 *   6. Score is non-negative
 *   7. Input queue has at most 2 pending directions
 *   8. No consecutive duplicate directions in inputQueue
 *   9. Elapsed time is non-negative
 *  10. No snake segment overlaps with another (except during growth)
 */
export class SnakeGame {
    private readonly snake: ReadonlyArray<Position>;
    private readonly food: Position;
    private readonly direction: Direction;
    private readonly inputQueue: ReadonlyArray<Direction>;
    private readonly status: GameStatus;
    private readonly score: number;
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private readonly startTime: number;
    private readonly elapsedTime: number;

    /**
     * Private constructor - use static factory methods to create instances
     */
    private constructor(state: GameState) {
        this.snake = state.snake;
        this.food = state.food;
        this.direction = state.direction;
        this.inputQueue = state.inputQueue;
        this.status = state.status;
        this.score = state.score;
        this.gridWidth = state.gridWidth;
        this.gridHeight = state.gridHeight;
        this.startTime = state.startTime;
        this.elapsedTime = state.elapsedTime;
        this.checkRep();
    }

    /**
     * Check representation invariants
     * @throws Error if any invariant is violated
     */
    private checkRep(): void {
        // Invariant 1: Snake has at least one segment
        if (this.snake.length === 0) {
            throw new Error('Invariant violation: snake must have at least one segment');
        }

        // Invariant 2: All snake positions are within grid bounds
        for (const pos of this.snake) {
            if (pos.x < 0 || pos.x >= this.gridWidth || pos.y < 0 || pos.y >= this.gridHeight) {
                throw new Error(`Invariant violation: snake position (${pos.x}, ${pos.y}) out of bounds`);
            }
        }

        // Invariant 3: Food position is within grid bounds
        if (this.food.x < 0 || this.food.x >= this.gridWidth || 
            this.food.y < 0 || this.food.y >= this.gridHeight) {
            throw new Error(`Invariant violation: food position (${this.food.x}, ${this.food.y}) out of bounds`);
        }

        // Invariant 4: Food is not on any snake segment
        for (const pos of this.snake) {
            if (pos.x === this.food.x && pos.y === this.food.y) {
                throw new Error('Invariant violation: food cannot be on snake');
            }
        }

        // Invariant 5: Grid dimensions are positive
        if (this.gridWidth <= 0 || this.gridHeight <= 0) {
            throw new Error('Invariant violation: grid dimensions must be positive');
        }

        // Invariant 6: Score is non-negative
        if (this.score < 0) {
            throw new Error('Invariant violation: score cannot be negative');
        }

        // Invariant 7: Input queue has at most 2 pending directions
        if (this.inputQueue.length > 2) {
            throw new Error('Invariant violation: input queue cannot exceed 2 directions');
        }

        // Invariant 8: No consecutive duplicate directions in inputQueue
        for (let i = 0; i < this.inputQueue.length - 1; i++) {
            if (this.inputQueue[i] === this.inputQueue[i + 1]) {
                throw new Error('Invariant violation: no consecutive duplicate directions in queue');
            }
        }

        // Invariant 9: Elapsed time is non-negative
        if (this.elapsedTime < 0) {
            throw new Error('Invariant violation: elapsed time cannot be negative');
        }

        // Invariant 10: No snake segment overlaps (except head during growth frame)
        const positions = new Set<string>();
        for (let i = 1; i < this.snake.length; i++) { // Skip head (index 0)
            const key = `${this.snake[i].x},${this.snake[i].y}`;
            if (positions.has(key)) {
                throw new Error('Invariant violation: snake segments cannot overlap');
            }
            positions.add(key);
        }
    }

    /**
     * Create a new game instance with default settings
     * 
     * @param gridWidth - Width of the game grid (default: 20)
     * @param gridHeight - Height of the game grid (default: 20)
     * @returns A new SnakeGame instance in NOT_STARTED state
     */
    public static create(gridWidth: number = 20, gridHeight: number = 20): SnakeGame {
        const centerX = Math.floor(gridWidth / 2);
        const centerY = Math.floor(gridHeight / 2);
        
        const initialSnake: Position[] = [{ x: centerX, y: centerY }];
        const food = SnakeGame.generateFood(initialSnake, gridWidth, gridHeight);

        return new SnakeGame({
            snake: initialSnake,
            food,
            direction: 'RIGHT',
            inputQueue: [],
            status: 'NOT_STARTED',
            score: 0,
            gridWidth,
            gridHeight,
            startTime: 0,
            elapsedTime: 0
        });
    }

    /**
     * Start the game
     * 
     * @returns A new SnakeGame instance with status PLAYING and timer started
     */
    public start(): SnakeGame {
        if (this.status === 'PLAYING') {
            return this;
        }

        return new SnakeGame({
            ...this.serialize(),
            status: 'PLAYING',
            startTime: Date.now(),
            elapsedTime: 0
        });
    }

    /**
     * Queue a direction change
     * 
     * @param newDirection - Direction to queue
     * @returns A new SnakeGame instance with the direction queued (if valid)
     * 
     * Effects: 
     * - Ignores invalid directions (opposite of current or last queued)
     * - Ignores if queue is full (2 items)
     * - Prevents consecutive duplicates
     */
    public queueDirection(newDirection: Direction): SnakeGame {
        if (this.status !== 'PLAYING') {
            return this;
        }

        // Queue is full
        if (this.inputQueue.length >= 2) {
            return this;
        }

        // Determine the last effective direction
        const lastDirection = this.inputQueue.length > 0 
            ? this.inputQueue[this.inputQueue.length - 1] 
            : this.direction;

        // Ignore opposite direction
        if (this.isOpposite(newDirection, lastDirection)) {
            return this;
        }

        // Ignore duplicate
        if (newDirection === lastDirection) {
            return this;
        }

        return new SnakeGame({
            ...this.serialize(),
            inputQueue: [...this.inputQueue, newDirection]
        });
    }

    /**
     * Advance game by one tick
     * 
     * @returns A new SnakeGame instance after one game tick
     * 
     * Effects:
     * - Processes one direction from input queue (if any)
     * - Moves snake one cell in current direction
     * - Checks for food consumption (grows snake, updates score)
     * - Checks for collisions (sets GAME_OVER)
     * - Updates elapsed time
     */
    public tick(): SnakeGame {
        if (this.status !== 'PLAYING') {
            return this;
        }

        // Process input queue
        let newDirection = this.direction;
        let newQueue = this.inputQueue;
        
        if (this.inputQueue.length > 0) {
            newDirection = this.inputQueue[0];
            newQueue = this.inputQueue.slice(1);
        }

        // Calculate new head position
        const head = this.snake[0];
        const newHead = this.getNextPosition(head, newDirection);

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= this.gridWidth || 
            newHead.y < 0 || newHead.y >= this.gridHeight) {
            return new SnakeGame({
                ...this.serialize(),
                status: 'GAME_OVER',
                direction: newDirection,
                inputQueue: newQueue
            });
        }

        // Check self-collision
        for (const segment of this.snake) {
            if (newHead.x === segment.x && newHead.y === segment.y) {
                return new SnakeGame({
                    ...this.serialize(),
                    status: 'GAME_OVER',
                    direction: newDirection,
                    inputQueue: newQueue
                });
            }
        }

        // Check food consumption
        const ateFood = newHead.x === this.food.x && newHead.y === this.food.y;
        
        let newSnake: Position[];
        let newFood = this.food;
        let newScore = this.score;

        if (ateFood) {
            // Grow snake (keep tail)
            newSnake = [newHead, ...this.snake];
            newScore = this.score + 10;
            newFood = SnakeGame.generateFood(newSnake, this.gridWidth, this.gridHeight);
        } else {
            // Move snake (remove tail)
            newSnake = [newHead, ...this.snake.slice(0, -1)];
        }

        // Update elapsed time
        const newElapsedTime = Date.now() - this.startTime;

        return new SnakeGame({
            snake: newSnake,
            food: newFood,
            direction: newDirection,
            inputQueue: newQueue,
            status: 'PLAYING',
            score: newScore,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            startTime: this.startTime,
            elapsedTime: newElapsedTime
        });
    }

    /**
     * Restart the game with same grid dimensions
     * 
     * @returns A new SnakeGame instance in NOT_STARTED state
     */
    public restart(): SnakeGame {
        return SnakeGame.create(this.gridWidth, this.gridHeight);
    }

    /**
     * Get the game status
     * 
     * @returns Current game status
     */
    public getStatus(): GameStatus {
        return this.status;
    }

    /**
     * Get the current score
     * 
     * @returns Current score
     */
    public getScore(): number {
        return this.score;
    }

    /**
     * Get elapsed time in milliseconds
     * 
     * @returns Elapsed time since game started
     */
    public getElapsedTime(): number {
        return this.elapsedTime;
    }

    /**
     * Serialize the game state for rendering or persistence
     * 
     * @returns Complete game state object
     */
    public serialize(): GameState {
        return {
            snake: this.snake,
            food: this.food,
            direction: this.direction,
            inputQueue: this.inputQueue,
            status: this.status,
            score: this.score,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            startTime: this.startTime,
            elapsedTime: this.elapsedTime
        };
    }

    /**
     * Check if two directions are opposite
     */
    private isOpposite(dir1: Direction, dir2: Direction): boolean {
        return (dir1 === 'UP' && dir2 === 'DOWN') ||
               (dir1 === 'DOWN' && dir2 === 'UP') ||
               (dir1 === 'LEFT' && dir2 === 'RIGHT') ||
               (dir1 === 'RIGHT' && dir2 === 'LEFT');
    }

    /**
     * Get next position given current position and direction
     */
    private getNextPosition(pos: Position, dir: Direction): Position {
        switch (dir) {
            case 'UP':
                return { x: pos.x, y: pos.y - 1 };
            case 'DOWN':
                return { x: pos.x, y: pos.y + 1 };
            case 'LEFT':
                return { x: pos.x - 1, y: pos.y };
            case 'RIGHT':
                return { x: pos.x + 1, y: pos.y };
        }
    }

    /**
     * Generate a random food position not occupied by snake
     */
    private static generateFood(snake: ReadonlyArray<Position>, gridWidth: number, gridHeight: number): Position {
        const occupied = new Set(snake.map(pos => `${pos.x},${pos.y}`));
        
        let food: Position;
        do {
            food = {
                x: Math.floor(Math.random() * gridWidth),
                y: Math.floor(Math.random() * gridHeight)
            };
        } while (occupied.has(`${food.x},${food.y}`));

        return food;
    }
}
