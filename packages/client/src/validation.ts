import { z } from 'zod';
import type { ServerMessage } from '@snake/shared';

const PositionSchema = z.object({
    x: z.number(),
    y: z.number()
});

const DirectionSchema = z.enum(['UP', 'DOWN', 'LEFT', 'RIGHT']);

const SnakeGameDTOSchema = z.object({
    snake: z.array(PositionSchema),
    food: PositionSchema,
    direction: DirectionSchema,
    queuedDir1: DirectionSchema.nullable(),
    queuedDir2: DirectionSchema.nullable(),
    score: z.number(),
    gridWidth: z.number(),
    gridHeight: z.number(),
    startTime: z.number(),
    elapsedTime: z.number(),
    tickCount: z.number()
});

const ClientInfoSchema = z.object({
    clientId: z.string(),
    name: z.string(),
    ready: z.boolean()
});

const JoinedMessageSchema = z.object({
    type: z.literal('joined'),
    clientId: z.string(),
    name: z.string()
});

const ClientsListMessageSchema = z.object({
    type: z.literal('clients'),
    clients: z.array(ClientInfoSchema)
});

const GameStartMessageSchema = z.object({
    type: z.literal('game_start'),
    startTimeMs: z.number(),
    playerState: SnakeGameDTOSchema,
    opponentState: SnakeGameDTOSchema
});

const TickMessageSchema = z.object({
    type: z.literal('tick'),
    tickCount: z.number(),
    playerState: SnakeGameDTOSchema,
    opponentState: SnakeGameDTOSchema
});

const CountdownMessageSchema = z.object({
    type: z.literal('countdown'),
    secondsRemaining: z.number()
});

const GameOverMessageSchema = z.object({
    type: z.literal('game_over'),
    winner: z.string().nullable()
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
    JoinedMessageSchema,
    ClientsListMessageSchema,
    GameStartMessageSchema,
    TickMessageSchema,
    CountdownMessageSchema,
    GameOverMessageSchema
]);

export function parseServerMessage(data: unknown): ServerMessage | null {
    const result = ServerMessageSchema.safeParse(data);
    if (result.success) {
        return result.data as ServerMessage;
    }
    console.error('Invalid server message:', result.error);
    return null;
}
