/**
 * Classic Snake Game ADT (Abstract Data Type)
 * 
 * This mutable ADT represents the complete state and logic of a Snake game.
 * Following MIT 6.102 principles:
 * - Mutable design with defensive copying on inputs/outputs
 * - Representation invariants: checked after every operation
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

export class SnakeGame {
    private snake: Position[];
    private food: Position;
    private direction: Direction;
    private queuedDir1: Direction | null;
    private queuedDir2: Direction | null;
    private status: GameStatus;
    private score: number;
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private startTime: number;
    private elapsedTime: number;
    private tickCount: number;

    /**
     * SnakeGame ADT - Mutable representation of Snake game logic with defensive copying
     * 
     * Abstraction Function:
     *   AF(snake, food, direction, queuedDir1, queuedDir2, status, score, gridWidth, gridHeight, startTime, elapsedTime) = 
     *     A Snake game where:
     *     - The snake occupies positions snake[0] (head), snake[1], ..., snake[n-1] (tail)
     *     - Food is located at position 'food'
     *     - The snake head was facing 'direction' when it moved to current position
     *     - 'queuedDir1' is the direction in which the snake will go on the next tick
     *     - 'queuedDir2' will be set to 'queuedDir1' after the next tick
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
     *  10. No snake segment overlaps with another
     */

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
     * Private constructor - use static factory methods to create instances
     * 
     * @param gridWidth - Width of the grid
     * @param gridHeight - Height of the grid
     * @param initialLength - Initial length of the snake (default: 1)
     */
    private constructor(gridWidth: number, gridHeight: number, initialLength: number = 1) {
        if (gridWidth <= 0 || gridHeight <= 0) {
            throw new Error('Grid dimensions must be positive');
        }
        
        if (initialLength < 1) {
            throw new Error('Initial length must be at least 1');
        }
        
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        
        // Initialize with default values
        const centerX = Math.floor(gridWidth / 2);
        const centerY = Math.floor(gridHeight / 2);
        
        // Create snake with head at center, body extending to the left
        this.snake = [];
        for (let i = 0; i < initialLength; i++) {
            const segmentX = centerX - i;
            if (segmentX < 0) {
                throw new Error(`Initial length ${initialLength} is too long for grid width ${gridWidth}`);
            }
            this.snake.push({ x: segmentX, y: centerY });
        }
        this.direction = 'RIGHT';
        this.queuedDir1 = null;
        this.queuedDir2 = null;
        this.status = 'NOT_STARTED';
        this.score = 0;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.tickCount = 0;
        this.food = SnakeGame.generateFood(this.snake, this.gridWidth, this.gridHeight);
        
        this.checkRep();
    }

    /**
     * Create a new game instance with default settings
     * 
     * @param gridWidth - Width of the game grid (default: 20)
     * @param gridHeight - Height of the game grid (default: 20)
     * @param initialLength - Initial length of the snake (default: 1)
     * @returns A new SnakeGame instance in NOT_STARTED state
     */
    public static create(gridWidth: number = 20, gridHeight: number = 20, initialLength: number = 1): SnakeGame {
        return new SnakeGame(gridWidth, gridHeight, initialLength);
    }

    /**
     * Start the game
     * 
     * Mutates the game state to PLAYING and starts the timer
     */
    public start(): void {
        if (this.status === 'PLAYING') {
            return;
        }

        this.status = 'PLAYING';
        this.startTime = Date.now();
        this.elapsedTime = 0;
        
        this.checkRep();
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
     * 
     * Effects: 
     * - Ignores invalid directions (opposite of current or last queued)
     * - Ignores if both queue slots are full
     * - Prevents consecutive duplicates
     */
    public queueDirection(newDirection: Direction): void {
        if (!this.canQueueDirection(newDirection)) {
            return;
        }

        if (this.queuedDir2 === null && this.queuedDir1 !== null) {
            // Second slot empty
            this.queuedDir2 = newDirection;
        } else {
            // First slot empty
            this.queuedDir1 = newDirection;
        }
        
        this.checkRep();
    }

    /**
     * Advance game by one tick
     * 
     * Effects:
     * - Processes one direction from queue (if any)
     * - Moves snake one cell in current direction
     * - Checks for food consumption (grows snake, updates score)
     * - Checks for collisions (sets GAME_OVER)
     * - Updates elapsed time
     */
    public tick(): void {
        if (this.status !== 'PLAYING') {
            return;
        }

        // Process queued direction
        if (this.queuedDir1 !== null) {
            this.direction = this.queuedDir1;
            this.queuedDir1 = this.queuedDir2;
            this.queuedDir2 = null;
        }

        // Calculate new head position
        const head = this.snake[0];
        const newHead = this.getNextPosition(head, this.direction);

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= this.gridWidth ||
            newHead.y < 0 || newHead.y >= this.gridHeight) {
            this.status = 'GAME_OVER';
            this.checkRep();
            return;
        }

        // Check food consumption
        const ateFood = newHead.x === this.food.x && newHead.y === this.food.y;

        if (ateFood) {
            // Grow snake (keep tail)
            this.snake.unshift(newHead);
            this.score += 10;
            this.food = SnakeGame.generateFood(this.snake, this.gridWidth, this.gridHeight);
        } else {
            // Move snake (remove tail)
            this.snake.pop();
            this.snake.unshift(newHead);
        }

        // Check self-collision against the new snake body
        // Skip the head (index 0) since that's the new position we're checking
        for (let i = 1; i < this.snake.length; i++) {
            const segment = this.snake[i];
            if (newHead.x === segment.x && newHead.y === segment.y) {
                this.status = 'GAME_OVER';
                this.checkRep();
                return;
            }
        }

        // Update elapsed time
        this.elapsedTime = Date.now() - this.startTime;
        this.tickCount++;

        this.checkRep();
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
     * Get the snake positions (defensive copy)
     * 
     * @returns Array of snake segment positions
     */
    public getSnake(): ReadonlyArray<Position> {
        return this.snake.map(pos => ({ ...pos }));
    }

    /**
     * Get the food position (defensive copy)
     * 
     * @returns Food position
     */
    public getFood(): Position {
        return { ...this.food };
    }

    /**
     * Get the current direction
     * 
     * @returns Current direction
     */
    public getDirection(): Direction {
        return this.direction;
    }

    /**
     * Get the grid width
     * 
     * @returns Grid width
     */
    public getGridWidth(): number {
        return this.gridWidth;
    }

    /**
     * Get the grid height
     * 
     * @returns Grid height
     */
    public getGridHeight(): number {
        return this.gridHeight;
    }

    /**
     * Get the start time
     * 
     * @returns Start time timestamp
     */
    public getStartTime(): number {
        return this.startTime;
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
    private static generateFood(snake: Position[], gridWidth: number, gridHeight: number): Position {
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
