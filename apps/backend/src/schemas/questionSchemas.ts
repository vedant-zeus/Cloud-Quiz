import { z } from 'zod';

export const createQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Question text cannot be empty')
    .max(1000, 'Question text must not exceed 1000 characters'),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Answer option cannot be empty')
        .max(500, 'Answer option must not exceed 500 characters')
    )
    .length(4, 'Exactly four answer options are required'),
  correctAnswer: z
    .number()
    .int()
    .min(0, 'Correct answer index must be between 0 and 3')
    .max(3, 'Correct answer index must be between 0 and 3'),
  points: z
    .number()
    .int()
    .min(1, 'Points must be at least 1')
    .max(1000, 'Points must not exceed 1000')
    .default(100),
  timeLimitSeconds: z
    .number()
    .int()
    .min(5, 'Time limit must be at least 5 seconds')
    .max(180, 'Time limit must not exceed 180 seconds')
    .default(20),
});

export const updateQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Question text cannot be empty')
    .max(1000, 'Question text must not exceed 1000 characters')
    .optional(),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Answer option cannot be empty')
        .max(500, 'Answer option must not exceed 500 characters')
    )
    .length(4, 'Exactly four answer options are required')
    .optional(),
  correctAnswer: z
    .number()
    .int()
    .min(0, 'Correct answer index must be between 0 and 3')
    .max(3, 'Correct answer index must be between 0 and 3')
    .optional(),
  points: z
    .number()
    .int()
    .min(1, 'Points must be at least 1')
    .max(1000, 'Points must not exceed 1000')
    .optional(),
  timeLimitSeconds: z
    .number()
    .int()
    .min(5, 'Time limit must be at least 5 seconds')
    .max(180, 'Time limit must not exceed 180 seconds')
    .optional(),
});

export const questionParamsSchema = z.object({
  id: z.string().uuid('Invalid quiz ID format'),
  questionId: z.string().uuid('Invalid question ID format'),
});

export const reorderQuestionsSchema = z.object({
  orders: z
    .array(
      z.object({
        questionId: z.string().uuid('Invalid question ID format'),
        orderIndex: z.number().int().min(0, 'orderIndex must be a non-negative integer'),
      })
    )
    .min(1, 'At least one question order must be provided'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
