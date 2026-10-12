import { apiClient } from '../lib/axios';
import { Question, ApiResponse } from '../types';

export interface CreateQuestionPayload {
  text: string;
  options: string[];
  correctAnswer: number;
  points: number;
  timeLimitSeconds: number;
}

export interface UpdateQuestionPayload {
  text?: string;
  options?: string[];
  correctAnswer?: number;
  points?: number;
  timeLimitSeconds?: number;
}

export interface ReorderQuestionOrder {
  questionId: string;
  orderIndex: number;
}

export const questionApi = {
  async addQuestion(quizId: string, data: CreateQuestionPayload): Promise<Question> {
    const res = await apiClient.post<ApiResponse<{ question: Question }>>(
      `/quizzes/${quizId}/questions`,
      data
    );
    return res.data.data.question;
  },

  async updateQuestion(
    quizId: string,
    questionId: string,
    data: UpdateQuestionPayload
  ): Promise<Question> {
    const res = await apiClient.patch<ApiResponse<{ question: Question }>>(
      `/quizzes/${quizId}/questions/${questionId}`,
      data
    );
    return res.data.data.question;
  },

  async deleteQuestion(quizId: string, questionId: string): Promise<Question> {
    const res = await apiClient.delete<ApiResponse<{ question: Question }>>(
      `/quizzes/${quizId}/questions/${questionId}`
    );
    return res.data.data.question;
  },

  async reorderQuestions(
    quizId: string,
    orders: ReorderQuestionOrder[]
  ): Promise<Question[]> {
    const res = await apiClient.put<ApiResponse<{ questions: Question[] }>>(
      `/quizzes/${quizId}/questions/reorder`,
      { orders }
    );
    return res.data.data.questions;
  },
};
