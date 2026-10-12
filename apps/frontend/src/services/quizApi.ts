import { apiClient } from '../lib/axios';
import { Quiz, QuizMetrics, PaginatedResponse, ApiResponse } from '../types';

export interface CreateQuizPayload {
  title: string;
  description?: string;
}

export interface UpdateQuizPayload {
  title?: string;
  description?: string | null;
}

export interface ListQuizzesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const quizApi = {
  async listQuizzes(params?: ListQuizzesParams): Promise<PaginatedResponse<Quiz>> {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<Quiz>>>('/quizzes', {
      params,
    });
    return res.data.data;
  },

  async getMetrics(): Promise<QuizMetrics> {
    const res = await apiClient.get<ApiResponse<{ metrics: QuizMetrics }>>('/quizzes/metrics');
    return res.data.data.metrics;
  },

  async getQuizById(id: string): Promise<Quiz> {
    const res = await apiClient.get<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}`);
    return res.data.data.quiz;
  },

  async createQuiz(data: CreateQuizPayload): Promise<Quiz> {
    const res = await apiClient.post<ApiResponse<{ quiz: Quiz }>>('/quizzes', data);
    return res.data.data.quiz;
  },

  async updateQuiz(id: string, data: UpdateQuizPayload): Promise<Quiz> {
    const res = await apiClient.patch<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}`, data);
    return res.data.data.quiz;
  },

  async deleteQuiz(id: string): Promise<Quiz> {
    const res = await apiClient.delete<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}`);
    return res.data.data.quiz;
  },

  async publishQuiz(id: string): Promise<Quiz> {
    const res = await apiClient.post<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}/publish`);
    return res.data.data.quiz;
  },

  async archiveQuiz(id: string): Promise<Quiz> {
    const res = await apiClient.post<ApiResponse<{ quiz: Quiz }>>(`/quizzes/${id}/archive`);
    return res.data.data.quiz;
  },
};
