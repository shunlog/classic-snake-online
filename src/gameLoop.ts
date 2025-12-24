/**
 * Game Loop Framework
 * 
 * Provides a reusable game loop with fixed timestep updates
 * and variable rate rendering using requestAnimationFrame.
 */

export interface GameLoopCallbacks {
    /** Called at fixed update rate (dt in seconds) */
    update: (dt: number) => void;
    /** Called every frame for rendering */
    render: () => void;
    /** Called for input events */
    handleInput: (event: KeyboardEvent) => void;
}

export interface GameLoopOptions {
    /** Update tick rate in Hz (default: 60) */
    updateRate?: number;
    /** Maximum frame delta to avoid spiral of death, in seconds (default: 0.25) */
    maxDelta?: number;
}

export class GameLoop {
    private callbacks: GameLoopCallbacks;
    private tickInterval: number;
    private maxDelta: number;
    
    private frameId: number | null = null;
    private timeAcc: number = 0;
    private lastTime: number = 0;
    
    // FPS tracking
    private frameCount: number = 0;
    private fpsTime: number = 0;
    private _fps: number = 60;
    
    constructor(callbacks: GameLoopCallbacks, options: GameLoopOptions = {}) {
        this.callbacks = callbacks;
        this.tickInterval = 1 / (options.updateRate ?? 60);
        this.maxDelta = options.maxDelta ?? 0.25;
        
        // Bind the main loop to this instance
        this.loop = this.loop.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }
    
    /**
     * Get the current FPS
     */
    get fps(): number {
        return this._fps;
    }
    
    /**
     * Start the game loop
     */
    start(): void {
        if (this.frameId !== null) {
            return; // Already running
        }
        
        this.lastTime = performance.now() / 1000;
        this.timeAcc = 0;
        this.frameCount = 0;
        this.fpsTime = performance.now();
        
        // Setup input handler
        document.addEventListener('keydown', this.onKeyDown);
        
        // Start the loop
        this.frameId = window.requestAnimationFrame(this.loop);
    }
    
    /**
     * Stop the game loop
     */
    stop(): void {
        if (this.frameId !== null) {
            window.cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        // Remove input handler
        document.removeEventListener('keydown', this.onKeyDown);
    }
    
    /**
     * Main loop function
     */
    private loop(nowMs: number): void {
        this.frameId = window.requestAnimationFrame(this.loop);
        
        const now = nowMs / 1000; // Convert to seconds
        let dt = now - this.lastTime;
        this.lastTime = now;
        
        // Avoid spiral of death
        dt = Math.min(dt, this.maxDelta);
        
        // Calculate FPS
        this.frameCount++;
        const elapsed = performance.now() - this.fpsTime;
        if (elapsed >= 1000) {
            this._fps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.fpsTime = performance.now();
        }
        
        // Update with fixed timestep
        this.timeAcc += dt;
        while (this.timeAcc >= this.tickInterval) {
            this.callbacks.update(this.tickInterval);
            this.timeAcc -= this.tickInterval;
        }
        
        // Render
        this.callbacks.render();
    }
    
    /**
     * Input event handler
     */
    private onKeyDown(event: KeyboardEvent): void {
        this.callbacks.handleInput(event);
    }
}
