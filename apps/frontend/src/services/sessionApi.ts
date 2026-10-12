import { apiClient } from '../lib/axios';
import {
  ApiResponse,
  QuizSessionSummary,
  LeaderboardEntry,
  CompetitionAnalytics,
  ParticipantResult,
  HistoricalCompetitionSummary,
  PaginatedResult,
} from '../types';

export const sessionApi = {
  async createSession(quizId: string): Promise<QuizSessionSummary> {
    const res = await apiClient.post<ApiResponse<{ session: QuizSessionSummary }>>('/sessions', {
      quizId,
    });
    return res.data.data.session;
  },

  async getRoomInfo(roomCode: string): Promise<{
    roomCode: string;
    status: string;
    quizTitle: string;
    description: string | null;
    totalQuestions: number;
    participantCount: number;
  }> {
    const res = await apiClient.get<
      ApiResponse<{
        room: {
          roomCode: string;
          status: string;
          quizTitle: string;
          description: string | null;
          totalQuestions: number;
          participantCount: number;
        };
      }>
    >(`/sessions/${roomCode}`);
    return res.data.data.room;
  },

  async getResults(roomCode: string): Promise<{
    roomCode: string;
    quizTitle: string;
    status: string;
    totalQuestions: number;
    totalParticipants: number;
    leaderboard: LeaderboardEntry[];
  }> {
    const res = await apiClient.get<
      ApiResponse<{
        roomCode: string;
        quizTitle: string;
        status: string;
        totalQuestions: number;
        totalParticipants: number;
        leaderboard: LeaderboardEntry[];
      }>
    >(`/sessions/${roomCode}/results`);
    return res.data.data;
  },

  async getAnalytics(roomCode: string): Promise<CompetitionAnalytics> {
    const res = await apiClient.get<
      ApiResponse<{ analytics: CompetitionAnalytics }>
    >(`/sessions/${roomCode}/analytics`);
    return res.data.data.analytics;
  },

  async getParticipantResults(roomCode: string, token?: string): Promise<ParticipantResult> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['x-participant-token'] = token;
    }
    const res = await apiClient.get<ApiResponse<ParticipantResult>>(
      `/sessions/${roomCode}/participant-results`,
      { headers, params: token ? { token } : {} }
    );
    return res.data.data;
  },

  async listHistory(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedResult<HistoricalCompetitionSummary>> {
    const res = await apiClient.get<
      ApiResponse<PaginatedResult<HistoricalCompetitionSummary>>
    >('/history', { params });
    return res.data.data;
  },

  async getHistoryDetail(sessionId: string): Promise<{
    session: {
      id: string;
      roomCode: string;
      status: string;
      quizTitle: string;
      quizId: string;
      startedAt: string | null;
      endedAt: string | null;
      createdAt: string;
      participantCount: number;
    };
    analytics: CompetitionAnalytics;
    leaderboard: LeaderboardEntry[];
  }> {
    const res = await apiClient.get<
      ApiResponse<{
        session: {
          id: string;
          roomCode: string;
          status: string;
          quizTitle: string;
          quizId: string;
          startedAt: string | null;
          endedAt: string | null;
          createdAt: string;
          participantCount: number;
        };
        analytics: CompetitionAnalytics;
        leaderboard: LeaderboardEntry[];
      }>
    >(`/history/${sessionId}`);
    return res.data.data;
  },

  getLeaderboardCsvUrl(roomCode: string): string {
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:4000/api/v1';
    return `${baseUrl}/sessions/${roomCode}/export/leaderboard.csv`;
  },

  getAnswersCsvUrl(roomCode: string): string {
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:4000/api/v1';
    return `${baseUrl}/sessions/${roomCode}/export/answers.csv`;
  },
};
