import { Request } from 'express';
import { Role, SessionStatus } from '@prisma/client';

export { SessionStatus };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Phase 2 Socket and Session Types
export interface SafeQuestion {
  id: string;
  text: string;
  options: string[];
  points: number;
  timeLimitSeconds: number;
  questionNumber: number;
  totalQuestions: number;
  questionDeadline?: string | null;
}

export interface QuestionWithAnswer extends SafeQuestion {
  correctAnswer: number;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  score: number;
  rank: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  accuracy?: number;
  cumulativeResponseTimeMs?: number;
  rankChange?: number;
}

export interface AnswerStats {
  option0: number;
  option1: number;
  option2: number;
  option3: number;
  totalAnswered: number;
}

export interface OptionDistribution {
  optionIndex: number;
  text: string;
  count: number;
  percentage: number;
}

export interface DetailedQuestionAnalytics {
  questionId: string;
  questionNumber: number;
  text: string;
  options: string[];
  correctAnswer?: number;
  points: number;
  totalParticipants: number;
  submittedAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredCount: number;
  accuracyPercentage: number;
  optionDistribution: OptionDistribution[];
  averageResponseTimeMs: number;
  responseTimeDistribution: {
    under5s: number;
    between5and10s: number;
    between10and15s: number;
    over15s: number;
  };
}

export interface CompetitionAnalytics {
  sessionId: string;
  quizTitle: string;
  quizId: string;
  roomCode: string;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  totalParticipants: number;
  activeParticipants: number;
  participationRate: number;
  totalQuestions: number;
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  overallAccuracy: number;
  meanResponseTimeMs: number;
  highestScore: number;
  medianScore: number;
  scoreDistribution: Array<{ bracket: string; count: number }>;
  perQuestionStats: DetailedQuestionAnalytics[];
  mostChallengingQuestion: {
    id: string;
    questionNumber: number;
    text: string;
    accuracyPercentage: number;
  } | null;
  easiestQuestion: {
    id: string;
    questionNumber: number;
    text: string;
    accuracyPercentage: number;
  } | null;
  performanceTrends: Array<{
    questionNumber: number;
    accuracyPercentage: number;
    averageResponseTimeMs: number;
  }>;
}

export interface ParticipantResult {
  participant: {
    id: string;
    displayName: string;
    rank: number;
    score: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    accuracy: number;
    averageResponseTimeMs: number;
  };
  questions: Array<{
    questionId: string;
    questionNumber: number;
    text: string;
    options: string[];
    selectedOption: number | null;
    isCorrect: boolean | null;
    pointsAwarded: number;
    responseTimeMs: number | null;
    correctAnswer: number | null;
    points: number;
  }>;
  leaderboard: LeaderboardEntry[];
}

export interface HistoricalCompetitionSummary {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  roomCode: string;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  participantCount: number;
  highestScore: number;
}

export interface SafeRoomState {
  roomCode: string;
  status: SessionStatus;
  quizTitle: string;
  participantCount: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion?: SafeQuestion | null;
  questionDeadline?: string | null;
  hasAnsweredCurrent?: boolean;
  selectedOption?: number | null;
  closedQuestion?: {
    questionId: string;
    correctAnswer: number;
    stats: AnswerStats;
    isCorrect?: boolean;
    pointsAwarded?: number;
  } | null;
  leaderboard?: LeaderboardEntry[];
  myScore?: number;
  myRank?: number;
}
