import { z } from 'zod';

export const roomJoinSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
  displayName: z.string().trim().min(1, 'Display name is required').max(50),
});

export const roomSyncSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
});

export const quizStartSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
});

export const questionNextSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
});

export const questionCloseSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
});

export const answerSubmitSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
  questionId: z.string().uuid('Invalid question ID format'),
  selectedOption: z.number().int().min(0).max(3),
  submissionId: z.string().min(1, 'submissionId is required'),
});

export const quizEndSchema = z.object({
  roomCode: z.string().trim().min(1, 'Room code is required').max(10),
});

export type RoomJoinPayload = z.infer<typeof roomJoinSchema>;
export type RoomSyncPayload = z.infer<typeof roomSyncSchema>;
export type AnswerSubmitPayload = z.infer<typeof answerSubmitSchema>;
