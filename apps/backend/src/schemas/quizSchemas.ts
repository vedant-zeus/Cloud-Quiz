import { z } from 'zod';
import { QuizStatus } from '@prisma/client';

export const createQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Quiz title cannot be empty')
    .max(255, 'Quiz title must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Quiz description must not exceed 1000 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
});

export const updateQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Quiz title cannot be empty')
    .max(255, 'Quiz title must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Quiz description must not exceed 1000 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
});

export const quizIdParamSchema = z.object({
  id: z.string().uuid('Invalid quiz ID format'),
});

export const listQuizzesQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
  search: z.string().trim().optional(),
  status: z.nativeEnum(QuizStatus).optional(),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type ListQuizzesQuery = z.infer<typeof listQuizzesQuerySchema>;
