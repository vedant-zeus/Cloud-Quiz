import { z } from 'zod';

export const createSessionSchema = z.object({
  quizId: z.string().uuid('Invalid quiz ID format'),
});

export const roomCodeParamSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .min(1, 'Room code is required')
    .max(10, 'Room code must not exceed 10 characters'),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().optional(),
  status: z.enum(['WAITING', 'QUESTION_ACTIVE', 'QUESTION_CLOSED', 'COMPLETED']).optional(),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
