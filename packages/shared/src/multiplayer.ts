/**
 * Generic Multiplayer System with Client-Side Prediction and Server Reconciliation
 *
 * Following MIT 6.102 principles:
 * - Immutable interfaces for state and input
 * - Representation invariants checked after every mutation
 */

/**
 * Input packet sent from client to server
 */
export interface InputPacket<TInput> {
    readonly tick: number;
    readonly inputId: number;
    readonly payload: TInput;
}

/**
 * State packet sent from server to client
 */
export interface StatePacket<TState> {
    readonly tick: number;
    readonly lastProcessedInputId: number;
    readonly state: TState;
}

/**
 * MultiplayerClient ADT - Handles client-side prediction and server reconciliation
 *
 * Abstraction Function:
 *   AF(state, currentTick, pendingInputs, nextInputId, sendInput, applyInput, tick, cloneState) =
 *     A multiplayer client where:
 *     - 'state' is the current predicted game state
 *     - 'currentTick' is the current simulation tick
 *     - 'pendingInputs' is a queue of inputs sent to server but not yet acknowledged
 *     - 'nextInputId' is the ID to assign to the next input
 *
 * Representation Invariants:
 *   1. currentTick >= 0
 *   2. nextInputId >= 0
 *   3. pendingInputs are sorted by inputId ascending
 */
export class MultiplayerClient<TState, TInput> {
    private state: TState;
    private currentTick: number = 0;
    private pendingInputs: InputPacket<TInput>[] = [];
    private nextInputId: number = 0;

    private readonly sendInputPacket: (packet: InputPacket<TInput>) => void;
    private readonly applyInput: (state: TState, input: TInput) => void;
    private readonly simulate: (state: TState) => void;
    private readonly cloneState: (state: TState) => TState;

    /**
     * Create a new MultiplayerClient
     *
     * @param initialState - Initial game state
     * @param sendInputPacket - Callback to send input packets to server
     * @param applyInput - Function to apply an input to a state (mutates state)
     * @param simulate - Function to advance state by one tick (mutates state)
     * @param cloneState - Function to deep clone state
     */
    constructor(
        initialState: TState,
        sendInputPacket: (packet: InputPacket<TInput>) => void,
        applyInput: (state: TState, input: TInput) => void,
        simulate: (state: TState) => void,
        cloneState: (state: TState) => TState
    ) {
        this.state = cloneState(initialState);
        this.sendInputPacket = sendInputPacket;
        this.applyInput = applyInput;
        this.simulate = simulate;
        this.cloneState = cloneState;
        this.checkRep();
    }

    private checkRep(): void {
        if (this.currentTick < 0) {
            throw new Error('Invariant violation: currentTick cannot be negative');
        }
        if (this.nextInputId < 0) {
            throw new Error('Invariant violation: nextInputId cannot be negative');
        }
        for (let i = 1; i < this.pendingInputs.length; i++) {
            if (this.pendingInputs[i].inputId <= this.pendingInputs[i - 1].inputId) {
                throw new Error('Invariant violation: pendingInputs must be sorted by inputId');
            }
        }
    }

    /**
     * Process a player input
     *
     * Applies the input locally for prediction and sends it to the server
     *
     * @param input - The input to process
     */
    public input(input: TInput): void {
        const inputId = this.nextInputId++;
        const tick = this.currentTick;

        // Apply locally for prediction
        this.applyInput(this.state, input);

        // Store in pending queue
        const packet: InputPacket<TInput> = { tick, inputId, payload: input };
        this.pendingInputs.push(packet);

        // Send to server
        this.sendInputPacket(packet);

        this.checkRep();
    }

    /**
     * Advance the simulation by one tick
     */
    public tick(): void {
        this.currentTick++;
        this.simulate(this.state);
        this.checkRep();
    }

    /**
     * Handle a state packet from the server
     *
     * Reconciles server state with pending inputs
     *
     * @param packet - The server state packet
     */
    public onServerState(packet: StatePacket<TState>): void {
        // Remove acknowledged inputs
        this.pendingInputs = this.pendingInputs.filter(
            (p) => p.inputId > packet.lastProcessedInputId
        );

        // Snap to server state
        this.state = this.cloneState(packet.state);
        this.currentTick = packet.tick;

        // Reapply pending inputs (fast-forward)
        for (const pending of this.pendingInputs) {
            this.applyInput(this.state, pending.payload);
        }

        this.checkRep();
    }

    /**
     * Get the current predicted state
     *
     * @returns A clone of the current state
     */
    public getState(): TState {
        return this.cloneState(this.state);
    }

    /**
     * Get the current tick
     */
    public getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Get the number of pending (unacknowledged) inputs
     */
    public getPendingInputCount(): number {
        return this.pendingInputs.length;
    }
}

/**
 * MultiplayerServer ADT - Handles authoritative game state and input processing
 *
 * Abstraction Function:
 *   AF(state, currentTick, inputQueue, lastProcessedInputId, sendState, applyInput, simulate, cloneState) =
 *     A multiplayer server where:
 *     - 'state' is the authoritative game state
 *     - 'currentTick' is the current simulation tick
 *     - 'inputQueue' is a queue of inputs waiting to be applied
 *     - 'lastProcessedInputId' tracks the last acknowledged input
 *
 * Representation Invariants:
 *   1. currentTick >= 0
 */
export class MultiplayerServer<TState, TInput> {
    private state: TState;
    private currentTick: number = 0;
    private inputQueue: { targetTick: number; inputId: number; payload: TInput }[] = [];
    private lastProcessedInputId: number = -1;

    private readonly sendStatePacket: (packet: StatePacket<TState>) => void;
    private readonly applyInput: (state: TState, input: TInput) => void;
    private readonly simulate: (state: TState) => void;
    private readonly cloneState: (state: TState) => TState;

    /**
     * Create a new MultiplayerServer
     *
     * @param initialState - Initial game state
     * @param sendStatePacket - Callback to send state packets to client
     * @param applyInput - Function to apply an input to a state (mutates state)
     * @param simulate - Function to advance state by one tick (mutates state)
     * @param cloneState - Function to deep clone state
     */
    constructor(
        initialState: TState,
        sendStatePacket: (packet: StatePacket<TState>) => void,
        applyInput: (state: TState, input: TInput) => void,
        simulate: (state: TState) => void,
        cloneState: (state: TState) => TState
    ) {
        this.state = cloneState(initialState);
        this.sendStatePacket = sendStatePacket;
        this.applyInput = applyInput;
        this.simulate = simulate;
        this.cloneState = cloneState;
        this.checkRep();
    }

    private checkRep(): void {
        if (this.currentTick < 0) {
            throw new Error('Invariant violation: currentTick cannot be negative');
        }
    }

    /**
     * Handle an input packet from a client
     *
     * @param packet - The client input packet
     */
    public onClientInput(packet: InputPacket<TInput>): void {
        // If input is for a past tick, schedule it for current tick
        const targetTick = packet.tick < this.currentTick ? this.currentTick : packet.tick;

        this.inputQueue.push({
            targetTick,
            inputId: packet.inputId,
            payload: packet.payload,
        });

        this.checkRep();
    }

    /**
     * Advance the simulation by one tick
     *
     * Applies queued inputs, advances simulation, and sends state to client
     */
    public tick(): void {
        // Apply inputs scheduled for this tick
        const inputsForTick = this.inputQueue.filter((q) => q.targetTick === this.currentTick);
        this.inputQueue = this.inputQueue.filter((q) => q.targetTick !== this.currentTick);

        for (const queued of inputsForTick) {
            this.applyInput(this.state, queued.payload);
            if (queued.inputId > this.lastProcessedInputId) {
                this.lastProcessedInputId = queued.inputId;
            }
        }

        // Advance simulation
        this.simulate(this.state);
        this.currentTick++;

        // Send state to client
        this.sendStatePacket({
            tick: this.currentTick,
            lastProcessedInputId: this.lastProcessedInputId,
            state: this.cloneState(this.state),
        });

        this.checkRep();
    }

    /**
     * Get the current authoritative state
     *
     * @returns A clone of the current state
     */
    public getState(): TState {
        return this.cloneState(this.state);
    }

    /**
     * Get the current tick
     */
    public getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Get the number of queued inputs
     */
    public getInputQueueSize(): number {
        return this.inputQueue.length;
    }
}
