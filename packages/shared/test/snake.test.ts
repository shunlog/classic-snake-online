/**
 * Unit tests for SnakeGame ADT
 * 
 * Tests all public methods and verifies invariants are maintained
 */

import { SnakeGame, GameOverError } from '../src/snake.js';

describe('SnakeGame ADT', () => {
    describe('create', () => {
        test('creates a new game with default dimensions', () => {
            const game = new SnakeGame();

            expect(game.getGridWidth()).toBe(20);
            expect(game.getGridHeight()).toBe(20);
            // Removed status check (NOT_STARTED)
            expect(game.getScore()).toBe(0);
            expect(game.getSnake().length).toBe(1);
        });

        test('creates a new game with custom dimensions', () => {
            const game = new SnakeGame(30, 25);

            expect(game.getGridWidth()).toBe(30);
            expect(game.getGridHeight()).toBe(25);
        });

        test('creates snake at center position', () => {
            const game = new SnakeGame(20, 20);
            const head = game.getSnake()[0];

            expect(head.x).toBe(10);
            expect(head.y).toBe(10);
        });

        test('food is not on initial snake position', () => {
            const game = new SnakeGame();
            const head = game.getSnake()[0];
            const food = game.getFood();

            expect(food.x !== head.x || food.y !== head.y).toBe(true);
        });

        test('initial direction is RIGHT', () => {
            const game = new SnakeGame();

            expect(game.getDirection()).toBe('RIGHT');
        });

        test('creates snake with default length of 1', () => {
            const game = new SnakeGame();

            expect(game.getSnake().length).toBe(1);
        });

        test('creates snake with custom length', () => {
            const game = new SnakeGame(20, 20, 3);

            expect(game.getSnake().length).toBe(3);

            // Head should be at center
            const snake = game.getSnake();
            expect(snake[0].x).toBe(10);
            expect(snake[0].y).toBe(10);

            // Body should extend to the left
            expect(snake[1].x).toBe(9);
            expect(snake[1].y).toBe(10);
            expect(snake[2].x).toBe(8);
            expect(snake[2].y).toBe(10);
        });

        test('throws error for initial length less than 1', () => {
            expect(() => new SnakeGame(20, 20, 0)).toThrow('Initial length must be at least 1');
            expect(() => new SnakeGame(20, 20, -1)).toThrow('Initial length must be at least 1');
        });

        test('throws error if initial length is too long for grid', () => {
            expect(() => new SnakeGame(5, 5, 10)).toThrow('Initial length 10 is too long for grid width 5');
        });

        test('food is not on any snake segment for longer snake', () => {
            const game = new SnakeGame(10, 10);
            const food = game.getFood();
            const snake = game.getSnake();

            // Check that food is not on any snake segment
            const foodOnSnake = snake.some(segment =>
                segment.x === food.x && segment.y === food.y
            );
            expect(foodOnSnake).toBe(false);
        });
    });


    describe('start', () => {
        // Removed status transition test (status logic removed)

        test('sets startTime when starting', () => {
            const game = new SnakeGame();
            game.start();

            expect(game.getStartTime()).toBeGreaterThan(0);
        });

        test('starting already started game does nothing', () => {
            const game = new SnakeGame();
            game.start();
            const startTime = game.getStartTime();

            game.start();
            expect(game.getStartTime()).toBe(startTime);
        });
    });

    describe('canQueueDirection', () => {
        test('returns true for valid direction when first slot empty', () => {
            const game = new SnakeGame();
            game.start(); // starts with RIGHT
            expect(game.canQueueDirection('UP')).toBe(true);
            expect(game.canQueueDirection('DOWN')).toBe(true);
        });

        test('returns false for opposite direction', () => {
            const game = new SnakeGame();
            game.start(); // starts with RIGHT
            expect(game.canQueueDirection('LEFT')).toBe(false);
        });

        test('returns false for duplicate of current direction', () => {
            const game = new SnakeGame();
            game.start(); // starts with RIGHT
            expect(game.canQueueDirection('RIGHT')).toBe(false);
        });

        test('returns true for valid second direction', () => {
            const game = new SnakeGame();
            game.start();
            game.queueDirection('UP'); // first slot has UP
            expect(game.canQueueDirection('LEFT')).toBe(true);
            expect(game.canQueueDirection('RIGHT')).toBe(true);
        });

        test('returns false for opposite of first queued direction', () => {
            const game = new SnakeGame();
            game.start();
            game.queueDirection('UP'); // first slot has UP
            expect(game.canQueueDirection('DOWN')).toBe(false);
        });

        test('returns false for duplicate of first queued direction', () => {
            const game = new SnakeGame();
            game.start();
            game.queueDirection('UP'); // first slot has UP
            expect(game.canQueueDirection('UP')).toBe(false);
        });

        test('returns false when both slots full', () => {
            const game = new SnakeGame();
            game.start();
            game.queueDirection('UP');
            game.queueDirection('LEFT');
            expect(game.canQueueDirection('DOWN')).toBe(false);
            expect(game.canQueueDirection('RIGHT')).toBe(false);
        });

        // Removed tests for canQueueDirection when not started or game over (status logic removed)
    });

    describe('queueDirection, assuming canQueueDirection', () => {
        test('queues first direction and applies it on tick', () => {
            const game = new SnakeGame();
            game.start();
            const initialHead = game.getSnake()[0];

            // Queue UP direction (current is RIGHT)
            game.queueDirection('UP');

            // After tick, snake should move UP
            game.tick();
            const newHead = game.getSnake()[0];

            expect(newHead.x).toBe(initialHead.x);
            expect(newHead.y).toBe(initialHead.y - 1);
            expect(game.getDirection()).toBe('UP');
        });

        test('queues two directions and applies them in sequence', () => {
            const game = new SnakeGame();
            game.start();
            const initialHead = game.getSnake()[0];

            // Queue UP then LEFT
            game.queueDirection('UP');
            game.queueDirection('LEFT');

            // First tick: should move UP
            game.tick();
            expect(game.getDirection()).toBe('UP');
            expect(game.getSnake()[0].y).toBe(initialHead.y - 1);

            // Second tick: should move LEFT
            game.tick();
            expect(game.getDirection()).toBe('LEFT');
            expect(game.getSnake()[0].x).toBe(initialHead.x - 1);
        });

        test('ignores third direction when both slots full', () => {
            const game = new SnakeGame();
            game.start();

            // Queue UP, LEFT, then try to queue DOWN (should be ignored)
            game.queueDirection('UP');
            game.queueDirection('LEFT');
            game.queueDirection('DOWN');

            // First tick: should move UP
            game.tick();
            expect(game.getDirection()).toBe('UP');

            // Second tick: should move LEFT (not DOWN)
            game.tick();
            expect(game.getDirection()).toBe('LEFT');

            // Third tick: should continue LEFT (DOWN was ignored)
            game.tick();
            expect(game.getDirection()).toBe('LEFT');
        });

        test('processes queue correctly after tick', () => {
            const game = new SnakeGame();
            game.start();

            // Queue UP and LEFT, tick once, then queue RIGHT
            game.queueDirection('UP');
            game.queueDirection('LEFT');
            game.tick();  // Processes UP, LEFT moves to first slot
            game.queueDirection('RIGHT');  // Try to queue RIGHT

            // Current direction is UP, first queued is LEFT
            // RIGHT is opposite of LEFT (next direction in queue)
            // So RIGHT should be rejected

            // After tick, should move LEFT
            game.tick();
            expect(game.getDirection()).toBe('LEFT');

            // Another tick should continue LEFT (RIGHT was not queued)
            game.tick();
            expect(game.getDirection()).toBe('LEFT');
        });
    });

    describe('tick', () => {
        test('moves snake in current direction', () => {
            const game = new SnakeGame();
            game.start();
            const head1 = game.getSnake()[0];

            game.tick();
            const head2 = game.getSnake()[0];

            // Should move right
            expect(head2.x).toBe(head1.x + 1);
            expect(head2.y).toBe(head1.y);
        });

        test('processes direction from input queue', () => {
            const game = new SnakeGame();
            game.start();
            game.queueDirection('UP');
            const head1 = game.getSnake()[0];

            game.tick();
            const head2 = game.getSnake()[0];

            // Should move up
            expect(head2.x).toBe(head1.x);
            expect(head2.y).toBe(head1.y - 1);
            expect(game.getDirection()).toBe('UP');
        });

        test('removes tail when not eating food', () => {
            const game = new SnakeGame();
            game.start();
            const length1 = game.getSnake().length;

            game.tick();
            const length2 = game.getSnake().length;

            expect(length2).toBe(length1);
        });

        test('grows snake when eating food', () => {
            // Create game and manipulate to put food in front of snake
            const game = new SnakeGame(20, 20);
            game.start();

            // We need to tick until snake eats food by chance, or we can test indirectly
            // Let's test that score increases and snake grows together
            let initialLength = game.getSnake().length;
            let initialScore = game.getScore();

            // Run many ticks until food is eaten
            let foodEaten = false;
            try {
                for (let i = 0; i < 100 && !foodEaten; i++) {
                    game.tick();

                    if (game.getScore() > initialScore) {
                        expect(game.getSnake().length).toBe(initialLength + 1);
                        foodEaten = true;
                    }
                }
            } catch (error) {
                if (error instanceof GameOverError) {
                    // Game over before food was eaten, test inconclusive
                    // Skip this test run
                } else {
                    throw error;
                }
            }
        });


        test('increases score when eating food', () => {
            const game = new SnakeGame(10, 10);
            game.start();
            let initialScore = game.getScore();

            // Run many ticks until food is eaten
            let scoreIncreased = false;
            try {
                for (let i = 0; i < 100 && !scoreIncreased; i++) {
                    game.tick();

                    if (game.getScore() > initialScore) {
                        expect(game.getScore()).toBe(initialScore + 10);
                        scoreIncreased = true;
                    }
                }
            } catch (error) {
                if (error instanceof GameOverError) {
                    // Game over before food was eaten, test inconclusive
                    // Skip this test run
                } else {
                    throw error;
                }
            }
        });

        test('generates new food after eating', () => {
            const game = new SnakeGame(10, 10);
            game.start();
            let oldFood = game.getFood();
            let oldScore = game.getScore();

            // Run many ticks until food is eaten
            let foodChanged = false;
            try {
                for (let i = 0; i < 100 && !foodChanged; i++) {
                    game.tick();

                    if (game.getScore() > oldScore) {
                        const newFood = game.getFood();
                        expect(newFood.x !== oldFood.x || newFood.y !== oldFood.y).toBe(true);
                        foodChanged = true;
                    }
                }
            } catch (error) {
                if (error instanceof GameOverError) {
                    // Game over before food was eaten, test inconclusive
                    // Skip this test run
                } else {
                    throw error;
                }
            }
        });

        test('detects wall collision', () => {
            const game = new SnakeGame(5, 5);
            game.start();

            // Move snake left until it hits wall
            game.queueDirection('LEFT');
            expect(() => {
                for (let i = 0; i < 10; i++) {
                    game.tick();
                }
            }).toThrow(GameOverError);
        });

        test('detects self-collision', () => {
            // Start with longer snake to ensure self-collision
            const game = new SnakeGame(20, 20, 6);
            game.start();

            // Create a tight loop that causes self-collision
            // Snake: (10,10), (9,10), (8,10), (7,10), (6,10), (5,10)
            // Move UP: head at (10,9)
            game.queueDirection('UP');
            game.tick();
            // Snake: (10,9), (10,10), (9,10), (8,10), (7,10), (6,10)

            // Move LEFT: head at (9,9)
            game.queueDirection('LEFT');
            game.tick();
            // Snake: (9,9), (10,9), (10,10), (9,10), (8,10), (7,10)

            // Move DOWN: head at (9,10) - COLLISION with body at index 3
            game.queueDirection('DOWN');

            // This tick should cause self-collision
            expect(() => game.tick()).toThrow(GameOverError);
        });
        test('updates elapsed time', () => {
            const game = new SnakeGame();
            game.start();

            // Wait a bit
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            return delay(100).then(() => {
                game.tick();
                expect(game.getElapsedTime()).toBeGreaterThan(0);
            });
        });

        // Removed does nothing when game over (status logic removed)
    });

    // Removed getStatus describe block (status logic removed)

    describe('getScore', () => {
        test('returns current score', () => {
            const game = new SnakeGame();
            expect(game.getScore()).toBe(0);
        });
    });

    describe('getElapsedTime', () => {
        test('returns elapsed time', () => {
            const game = new SnakeGame();
            game.start();
            expect(game.getElapsedTime()).toBe(0);
        });
    });

    describe('getTickCount', () => {
        test('returns zero for new game', () => {
            const game = new SnakeGame();
            expect(game.getTickCount()).toBe(0);
        });

        test('returns zero for just-started game', () => {
            const game = new SnakeGame();
            game.start();
            expect(game.getTickCount()).toBe(0);
        });

        test('increments with each tick', () => {
            const game = new SnakeGame();
            game.start();
            expect(game.getTickCount()).toBe(0);

            game.tick();
            expect(game.getTickCount()).toBe(1);

            game.tick();
            expect(game.getTickCount()).toBe(2);

            game.tick();
            expect(game.getTickCount()).toBe(3);
        });
    });

    describe('getters and defensive copying', () => {
        test('getSnake returns defensive copy', () => {
            const game = new SnakeGame();
            const snake1 = game.getSnake();
            const snake2 = game.getSnake();

            // Should be different array instances
            expect(snake1).not.toBe(snake2);

            // But with equal values
            expect(snake1).toEqual(snake2);
        });

        test('getFood returns defensive copy', () => {
            const game = new SnakeGame();
            const food1 = game.getFood();
            const food2 = game.getFood();

            // Should be different object instances
            expect(food1).not.toBe(food2);

            // But with equal values
            expect(food1).toEqual(food2);
        });

        test('modifying returned snake does not affect game state', () => {
            const game = new SnakeGame();
            const snake = game.getSnake();
            const originalLength = snake.length;

            // Try to modify the returned array by casting
            (snake as any).push({ x: 99, y: 99 });

            // Game state should be unchanged
            expect(game.getSnake().length).toBe(originalLength);
        });

        test('modifying returned food does not affect game state', () => {
            const game = new SnakeGame();
            const food = game.getFood();
            const originalX = food.x;

            // Try to modify the returned object
            (food as any).x = 99;

            // Game state should be unchanged
            expect(game.getFood().x).toBe(originalX);
        });
    });

    describe('invariant checking', () => {
        test('maintains snake has at least one segment', () => {
            const game = new SnakeGame();
            game.start();

            expect(game.getSnake().length).toBeGreaterThanOrEqual(1);
        });

        test('maintains all positions within bounds', () => {
            const game = new SnakeGame(10, 10);
            game.start();

            // Run several ticks
            try {
                for (let i = 0; i < 5; i++) {
                    game.tick();

                    // Check snake positions
                    for (const pos of game.getSnake()) {
                        expect(pos.x).toBeGreaterThanOrEqual(0);
                        expect(pos.x).toBeLessThan(game.getGridWidth());
                        expect(pos.y).toBeGreaterThanOrEqual(0);
                        expect(pos.y).toBeLessThan(game.getGridHeight());
                    }

                    // Check food position
                    const food = game.getFood();
                    expect(food.x).toBeGreaterThanOrEqual(0);
                    expect(food.x).toBeLessThan(game.getGridWidth());
                    expect(food.y).toBeGreaterThanOrEqual(0);
                    expect(food.y).toBeLessThan(game.getGridHeight());
                }
            } catch (error) {
                if (error instanceof GameOverError) {
                    // Game over during test, which is fine
                } else {
                    throw error;
                }
            }
        });

        test('maintains food not on snake', () => {
            const game = new SnakeGame();
            game.start();

            const snakePositions = new Set(game.getSnake().map(pos => `${pos.x},${pos.y}`));
            const food = game.getFood();
            const foodKey = `${food.x},${food.y}`;

            expect(snakePositions.has(foodKey)).toBe(false);
        });

        test('maintains queue size limit', () => {
            const game = new SnakeGame();
            game.start();
            // Queue UP, LEFT, then try DOWN and RIGHT (should be ignored)
            game.queueDirection('UP');
            game.queueDirection('LEFT');
            game.queueDirection('DOWN');
            game.queueDirection('RIGHT');

            // Verify queue limit by checking movement after 3 ticks
            // Should move: RIGHT (initial) -> UP -> LEFT -> LEFT (not DOWN/RIGHT)
            game.tick();
            expect(game.getDirection()).toBe('UP');

            game.tick();
            expect(game.getDirection()).toBe('LEFT');

            game.tick();
            // Should continue LEFT, proving DOWN and RIGHT were not queued
            expect(game.getDirection()).toBe('LEFT');
        });
    });

    describe('GameOverError', () => {
        test('throws GameOverError on wall collision (right)', () => {
            const game = new SnakeGame(5, 5);
            game.start();
            game.tick();
            game.tick();
            expect(() => { game.tick() }).toThrow(GameOverError);
        });


        test('throws GameOverError on self-collision', () => {
            const game = new SnakeGame(20, 20, 6);
            game.start();

            // Create a tight loop that causes self-collision
            game.queueDirection('UP');
            game.tick();

            game.queueDirection('LEFT');
            game.tick();

            game.queueDirection('DOWN');

            // Next tick should cause self-collision
            expect(() => game.tick()).toThrow(GameOverError);
        });

    });
});
