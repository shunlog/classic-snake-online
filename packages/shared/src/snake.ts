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
    readonly status: GameStatus;
    readonly score: number;
    readonly gridWidth: number;
    readonly gridHeight: number;
    readonly startTime: number;
    readonly elapsedTime: number;
    readonly tickCount: number;
}

/**
 * SnakeGame ADT - Immutable representation of Snake game logic
 * 
 * Abstraction Function:
 *   AF(snake, food, direction, queuedDir1, queuedDir2, status, score, gridWidth, gridHeight, startTime, elapsedTime) = 
 *     A Snake game where:
 *     - The snake occupies positions snake[0] (head), snake[1], ..., snake[n-1] (tail)
 *     - Food is located at position 'food'
 *     - Current movement direction is 'direction'
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
 *   7. If queuedDir2 is set, queuedDir1 must also be set
 *   8. queuedDir1 (if set) is different from queuedDir2 (if set)
 *   9. Elapsed time is non-negative
 *  10. No snake segment overlaps with another (except during growth)
 */

/**
 * Internal state interface (private to SnakeGame class)
 * Includes queue directions which are implementation details
 */
interface InternalState extends GameState {
    readonly queuedDir1: Direction | null;
    readonly queuedDir2: Direction | null;
}

export class SnakeGame {
    private readonly snake: ReadonlyArray<Position>;
    private readonly food: Position;
    private readonly direction: Direction;
    private readonly queuedDir1: Direction | null;
    private readonly queuedDir2: Direction | null;
    private readonly status: GameStatus;
    private readonly score: number;
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private readonly startTime: number;
    private readonly elapsedTime: number;
    private readonly tickCount: number;

    /**
     * Private constructor - use static factory methods to create instances
     */
    private constructor(state: InternalState) {
        this.snake = state.snake;
        this.food = state.food;
        this.direction = state.direction;
        this.queuedDir1 = state.queuedDir1;
        this.queuedDir2 = state.queuedDir2;
        this.status = state.status;
        this.score = state.score;
        this.gridWidth = state.gridWidth;
        this.gridHeight = state.gridHeight;
        this.startTime = state.startTime;
        this.elapsedTime = state.elapsedTime;
        this.tickCount = state.tickCount;
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

        // Invariant 7: If queuedDir2 is set, queuedDir1 must also be set
        if (this.queuedDir2 !== null && this.queuedDir1 === null) {
            throw new Error('Invariant violation: queuedDir2 cannot be set if queuedDir1 is null');
        }

        // Invariant 8: queuedDir1 (if set) is different from queuedDir2 (if set)
        if (this.queuedDir1 !== null && this.queuedDir1 === this.queuedDir2) {
            throw new Error('Invariant violation: queuedDir1 and queuedDir2 cannot be the same');
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
     * @param snakeLength - Initial length of the snake (default: 1, minimum: 1)
     * @returns A new SnakeGame instance in NOT_STARTED state
     */
    public static create(gridWidth: number = 20, gridHeight: number = 20, snakeLength: number = 1): SnakeGame {
        if (snakeLength < 1) {
            throw new Error('Snake length must be at least 1');
        }
        
        const centerX = Math.floor(gridWidth / 2);
        const centerY = Math.floor(gridHeight / 2);

        // Create snake with head at center, body extending to the left
        const initialSnake: Position[] = [];
        for (let i = 0; i < snakeLength; i++) {
            const segmentX = centerX - i;
            if (segmentX < 0) {
                throw new Error(`Snake length ${snakeLength} is too long for grid width ${gridWidth}`);
            }
            initialSnake.push({ x: segmentX, y: centerY });
        }

        const food = SnakeGame.generateFood(initialSnake, gridWidth, gridHeight);

        return new SnakeGame({
            snake: initialSnake,
            food,
            direction: 'RIGHT',
            queuedDir1: null,
            queuedDir2: null,
            status: 'NOT_STARTED',
            score: 0,
            gridWidth,
            gridHeight,
            startTime: 0,
            elapsedTime: 0,
            tickCount: 0
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
            queuedDir1: this.queuedDir1,
            queuedDir2: this.queuedDir2,
            status: 'PLAYING',
            startTime: Date.now(),
            elapsedTime: 0
        });
    }

    /**
     * Check if a direction can be queued
     * 
     * @param newDirection - Direction to check
     * @returns true if the direction can be queued, false otherwise
     * 
     * A direction can be queued if:
     * - Game is in PLAYING state
     * - At least one queue slot is available
     * - Direction is not opposite to the last effective direction
     * - Direction is not a duplicate of the last effective direction
     */
    public canQueueDirection(newDirection: Direction): boolean {
        if (this.status !== 'PLAYING') {
            return false;
        }

        if (this.queuedDir2 !== null) {
            // Both slots full
            return false;
        } else if (this.queuedDir2 === null && this.queuedDir1 !== null) {
            // Second slot empty - check against first queued direction
            if (this.isOpposite(newDirection, this.queuedDir1)
                || newDirection === this.queuedDir1) {
                return false;
            }
            return true;
        } else {
            // First slot empty - check against current direction
            if (this.isOpposite(newDirection, this.direction)
                || newDirection === this.direction) {
                return false;
            }
            return true;
        }
    }

    /**
     * Queue a direction change
     * 
     * @param newDirection - Direction to queue
     * @returns A new SnakeGame instance with the direction queued (if valid)
     * 
     * Effects: 
     * - Ignores invalid directions (opposite of current or last queued)
     * - Ignores if both queue slots are full
     * - Prevents consecutive duplicates
     */
    public queueDirection(newDirection: Direction): SnakeGame {
        if (!this.canQueueDirection(newDirection)) {
            return this;
        }

        if (this.queuedDir2 === null && this.queuedDir1 !== null) {
            // Second slot empty
            return new SnakeGame({
                ...this.serialize(),
                queuedDir1: this.queuedDir1,
                queuedDir2: newDirection
            });
        } else {
            // First slot empty
            return new SnakeGame({
                ...this.serialize(),
                queuedDir1: newDirection,
                queuedDir2: this.queuedDir2
            });
        }
    }

    /**
     * Advance game by one tick
     * 
     * @returns A new SnakeGame instance after one game tick
     * 
     * Effects:
     * - Processes one direction from queue (if any)
     * - Moves snake one cell in current direction
     * - Checks for food consumption (grows snake, updates score)
     * - Checks for collisions (sets GAME_OVER)
     * - Updates elapsed time
     */
    public tick(): SnakeGame {
        if (this.status !== 'PLAYING') {
            return this;
        }

        // Process queued direction
        let newDirection = this.direction;
        let newQueuedDir1 = this.queuedDir1;
        let newQueuedDir2 = this.queuedDir2;

        if (this.queuedDir1 !== null) {
            newDirection = this.queuedDir1;
            newQueuedDir1 = this.queuedDir2;
            newQueuedDir2 = null;
        }

        // Calculate new head position
        const head = this.snake[0];
        const newHead = this.getNextPosition(head, newDirection);

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= this.gridWidth ||
            newHead.y < 0 || newHead.y >= this.gridHeight) {
            return new SnakeGame({
                ...this.serialize(),
                queuedDir1: newQueuedDir1,
                queuedDir2: newQueuedDir2,
                status: 'GAME_OVER',
                direction: newDirection
            });
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

        // Check self-collision against the new snake body (after tail removal/growth)
        // Skip the head (index 0) since that's the new position we're checking
        for (let i = 1; i < newSnake.length; i++) {
            const segment = newSnake[i];
            if (newHead.x === segment.x && newHead.y === segment.y) {
                return new SnakeGame({
                    ...this.serialize(),
                    queuedDir1: newQueuedDir1,
                    queuedDir2: newQueuedDir2,
                    status: 'GAME_OVER',
                    direction: newDirection
                });
            }
        }

        // Update elapsed time
        const newElapsedTime = Date.now() - this.startTime;

        return new SnakeGame({
            snake: newSnake,
            food: newFood,
            direction: newDirection,
            queuedDir1: newQueuedDir1,
            queuedDir2: newQueuedDir2,
            status: 'PLAYING',
            score: newScore,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            startTime: this.startTime,
            elapsedTime: newElapsedTime,
            tickCount: this.tickCount + 1
        });
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
     * Get the number of ticks simulated since game started
     * 
     * @returns Number of ticks
     */
    public getTickCount(): number {
        return this.tickCount;
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
            status: this.status,
            score: this.score,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            startTime: this.startTime,
            elapsedTime: this.elapsedTime,
            tickCount: this.tickCount
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
