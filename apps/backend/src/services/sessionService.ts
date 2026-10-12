import { SessionStatus, Participant, QuizStatus } from '@prisma/client';
import {
  sessionRepository,
  SessionWithQuizAndQuestions,
} from '../repositories/sessionRepository.js';
import { quizRepository } from '../repositories/quizRepository.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { generateParticipantToken, hashToken } from '../utils/token.js';
import { timerManager } from '../socket/timerManager.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../utils/errors.js';
import { SafeRoomState, SafeQuestion, LeaderboardEntry } from '../types/index.js';
import { leaderboardService } from './leaderboardService.js';
import { analyticsService } from './analyticsService.js';

export class SessionService {
  async createSession(hostId: string, quizId: string) {
    const quiz = await quizRepository.findById(quizId);
    if (!quiz) {
      throw new NotFoundError('Quiz not found');
    }

    if (quiz.hostId !== hostId) {
      throw new ForbiddenError('You do not have permission to create a session for this quiz');
    }

    if (quiz.status !== QuizStatus.PUBLISHED) {
      throw new BadRequestError('Only published quizzes can be started as live sessions');
    }

    if (!quiz.questions || quiz.questions.length === 0) {
      throw new BadRequestError('The quiz must contain at least one question before starting a session');
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await sessionRepository.findByRoomCode(roomCode);
      if (!existing) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    const session = await sessionRepository.createSession(quizId, roomCode);

    return {
      session: {
        id: session.id,
        quizId: session.quizId,
        roomCode: session.roomCode,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        createdAt: session.createdAt,
      },
      host: {
        id: hostId,
      },
    };
  }

  async getSessionByRoomCode(roomCode: string): Promise<SessionWithQuizAndQuestions> {
    const session = await sessionRepository.findByRoomCode(roomCode);
    if (!session) {
      throw new NotFoundError(`Room "${roomCode.toUpperCase()}" not found`);
    }
    return session;
  }

  async getPublicRoomInfo(roomCode: string) {
    const session = await this.getSessionByRoomCode(roomCode);
    return {
      roomCode: session.roomCode,
      status: session.status,
      quizTitle: session.quiz.title,
      description: session.quiz.description,
      totalQuestions: session.quiz.questions.length,
      participantCount: session.participants.length,
    };
  }

  async getResults(roomCode: string, requestingHostId?: string) {
    const session = await this.getSessionByRoomCode(roomCode);

    if (session.status !== SessionStatus.COMPLETED) {
      if (!requestingHostId || session.quiz.hostId !== requestingHostId) {
        throw new ForbiddenError('Results are only accessible to the public after the session has completed');
      }
    }

    const leaderboard = await leaderboardService.getLeaderboard(session.id);

    return {
      roomCode: session.roomCode,
      quizTitle: session.quiz.title,
      status: session.status,
      totalQuestions: session.quiz.questions.length,
      totalParticipants: session.participants.length,
      leaderboard,
    };
  }

  async joinRoom(roomCode: string, displayName: string): Promise<{
    participant: Participant;
    token: string;
    roomState: SafeRoomState;
  }> {
    const session = await this.getSessionByRoomCode(roomCode);

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestError('This competition session has already ended and is no longer accepting participants');
    }

    if (session.status !== SessionStatus.WAITING) {
      throw new BadRequestError('The quiz has already started. New participants cannot join active rounds.');
    }

    const cleanName = displayName.trim();
    if (!cleanName || cleanName.length > 50) {
      throw new BadRequestError('Display name must be between 1 and 50 characters');
    }

    const duplicate = await sessionRepository.findParticipantByName(session.id, cleanName);
    if (duplicate) {
      throw new ConflictError('Display name is already taken in this room. Please choose another name.');
    }

    const token = generateParticipantToken();
    const tokenHash = hashToken(token);

    const participant = await sessionRepository.addParticipant(session.id, cleanName, tokenHash);

    // Refresh session to get updated participants count
    const updatedSession = await this.getSessionByRoomCode(roomCode);
    const roomState = await this.getRoomSnapshot(updatedSession, participant, false);

    return {
      participant,
      token,
      roomState,
    };
  }

  async authenticateParticipant(roomCode: string, token: string): Promise<Participant> {
    const session = await this.getSessionByRoomCode(roomCode);
    const tokenHash = hashToken(token);
    const participant = await sessionRepository.findParticipantByTokenHash(session.id, tokenHash);

    if (!participant) {
      throw new UnauthorizedError('Invalid or expired participant credential');
    }

    return participant;
  }

  async startQuiz(roomCode: string, hostId: string) {
    const session = await this.getSessionByRoomCode(roomCode);

    if (session.quiz.hostId !== hostId) {
      throw new ForbiddenError('Only the host of this quiz can start the session');
    }

    if (session.status !== SessionStatus.WAITING) {
      throw new BadRequestError(`Cannot start quiz from ${session.status} state. A quiz can only start from WAITING.`);
    }

    const questions = session.quiz.questions;
    if (questions.length === 0) {
      throw new BadRequestError('The quiz contains no questions to start');
    }

    const firstQ = questions[0];
    const deadline = new Date(Date.now() + firstQ.timeLimitSeconds * 1000);

    await sessionRepository.updateSession(session.id, {
      status: SessionStatus.QUESTION_ACTIVE,
      currentQuestionIndex: 0,
      questionDeadline: deadline,
      startedAt: session.startedAt || new Date(),
    });

    timerManager.scheduleQuestionTimer(session.roomCode, deadline);

    const safeQ: SafeQuestion = {
      id: firstQ.id,
      text: firstQ.text,
      options: firstQ.options as string[],
      points: firstQ.points,
      timeLimitSeconds: firstQ.timeLimitSeconds,
      questionNumber: 1,
      totalQuestions: questions.length,
      questionDeadline: deadline.toISOString(),
    };

    return {
      session,
      question: safeQ,
      deadline: deadline.toISOString(),
    };
  }

  async submitAnswer(data: {
    roomCode: string;
    participantId: string;
    questionId: string;
    selectedOption: number;
    submissionId: string;
  }): Promise<{ isCorrect: boolean; pointsAwarded: number }> {
    const session = await this.getSessionByRoomCode(data.roomCode);

    if (session.status !== SessionStatus.QUESTION_ACTIVE) {
      throw new BadRequestError('Answers can only be submitted while a question is actively open');
    }

    const currentQ = session.quiz.questions[session.currentQuestionIndex];
    if (!currentQ || currentQ.id !== data.questionId) {
      throw new BadRequestError('Submitted answer does not correspond to the currently active question');
    }

    if (data.selectedOption < 0 || data.selectedOption > 3) {
      throw new BadRequestError('Selected option must be an integer between 0 and 3');
    }

    // Check deadline (with 1500ms network latency grace)
    if (session.questionDeadline) {
      const now = Date.now();
      const deadline = new Date(session.questionDeadline).getTime();
      if (now > deadline + 1500) {
        throw new BadRequestError('Question submission deadline has already expired');
      }
    }

    const alreadyAnswered = await sessionRepository.hasParticipantAnswered(data.participantId, currentQ.id);
    if (alreadyAnswered) {
      throw new BadRequestError('You have already submitted an answer for this question');
    }

    // Server-side scoring calculation
    const isCorrect = data.selectedOption === currentQ.correctAnswer;
    const pointsAwarded = isCorrect ? currentQ.points : 0;

    // Calculate response time from question start
    const questionStartMs = session.questionDeadline
      ? new Date(session.questionDeadline).getTime() - currentQ.timeLimitSeconds * 1000
      : Date.now();
    const responseTimeMs = Math.max(
      0,
      Math.min(currentQ.timeLimitSeconds * 1000, Date.now() - questionStartMs)
    );

    await sessionRepository.recordAnswer({
      participantId: data.participantId,
      questionId: currentQ.id,
      selectedOption: data.selectedOption,
      isCorrect,
      pointsAwarded,
      submissionId: data.submissionId,
      responseTimeMs,
    });

    return { isCorrect, pointsAwarded };
  }

  async closeQuestion(roomCode: string, hostId?: string) {
    const session = await this.getSessionByRoomCode(roomCode);

    if (hostId && session.quiz.hostId !== hostId) {
      throw new ForbiddenError('Only the session host can close the active question');
    }

    // Idempotent: If question is already closed or quiz completed, do not close twice
    if (session.status !== SessionStatus.QUESTION_ACTIVE) {
      return null;
    }

    timerManager.clearTimer(session.roomCode);

    await sessionRepository.updateSession(session.id, {
      status: SessionStatus.QUESTION_CLOSED,
      questionDeadline: null,
    });

    const currentQ = session.quiz.questions[session.currentQuestionIndex];
    const stats = await sessionRepository.getQuestionStats(currentQ.id);
    const leaderboard = await leaderboardService.getLeaderboard(session.id);
    const detailedAnalytics = await analyticsService.getQuestionAnalytics(session.id, currentQ.id, true);

    return {
      questionId: currentQ.id,
      correctAnswer: currentQ.correctAnswer,
      stats,
      detailedAnalytics,
      leaderboard,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.quiz.questions.length,
    };
  }

  async nextQuestion(roomCode: string, hostId: string) {
    const session = await this.getSessionByRoomCode(roomCode);

    if (session.quiz.hostId !== hostId) {
      throw new ForbiddenError('Only the session host can advance questions');
    }

    if (session.status !== SessionStatus.QUESTION_CLOSED) {
      throw new BadRequestError('Cannot advance to next question while the current question is still active. Please close the question first.');
    }

    const nextIndex = session.currentQuestionIndex + 1;
    const totalQuestions = session.quiz.questions.length;

    if (nextIndex < totalQuestions) {
      const nextQ = session.quiz.questions[nextIndex];
      const deadline = new Date(Date.now() + nextQ.timeLimitSeconds * 1000);

      await sessionRepository.updateSession(session.id, {
        status: SessionStatus.QUESTION_ACTIVE,
        currentQuestionIndex: nextIndex,
        questionDeadline: deadline,
      });

      timerManager.scheduleQuestionTimer(session.roomCode, deadline);

      const safeQ: SafeQuestion = {
        id: nextQ.id,
        text: nextQ.text,
        options: nextQ.options as string[],
        points: nextQ.points,
        timeLimitSeconds: nextQ.timeLimitSeconds,
        questionNumber: nextIndex + 1,
        totalQuestions,
        questionDeadline: deadline.toISOString(),
      };

      return {
        isComplete: false,
        question: safeQ,
        deadline: deadline.toISOString(),
      };
    } else {
      // Completed!
      await sessionRepository.updateSession(session.id, {
        status: SessionStatus.COMPLETED,
        questionDeadline: null,
        endedAt: new Date(),
      });

      timerManager.clearTimer(session.roomCode);
      const leaderboard = await leaderboardService.getLeaderboard(session.id);

      return {
        isComplete: true,
        leaderboard,
      };
    }
  }

  async endQuiz(roomCode: string, hostId: string) {
    const session = await this.getSessionByRoomCode(roomCode);

    if (session.quiz.hostId !== hostId) {
      throw new ForbiddenError('Only the session host can end the competition');
    }

    timerManager.clearTimer(session.roomCode);

    await sessionRepository.updateSession(session.id, {
      status: SessionStatus.COMPLETED,
      questionDeadline: null,
      endedAt: new Date(),
    });

    const leaderboard = await leaderboardService.getLeaderboard(session.id);
    return { leaderboard };
  }

  async getRoomSnapshot(
    session: SessionWithQuizAndQuestions,
    participant?: Participant | null,
    isHost = false
  ): Promise<SafeRoomState> {
    const questions = session.quiz.questions;
    const currentQ = questions[session.currentQuestionIndex];

    let currentQuestion: SafeQuestion | null = null;
    let hasAnsweredCurrent = false;
    let selectedOption: number | null = null;
    let closedQuestion: SafeRoomState['closedQuestion'] = null;

    if (currentQ && session.status === SessionStatus.QUESTION_ACTIVE) {
      currentQuestion = {
        id: currentQ.id,
        text: currentQ.text,
        options: currentQ.options as string[],
        points: currentQ.points,
        timeLimitSeconds: currentQ.timeLimitSeconds,
        questionNumber: session.currentQuestionIndex + 1,
        totalQuestions: questions.length,
        questionDeadline: session.questionDeadline ? new Date(session.questionDeadline).toISOString() : null,
      };

      if (participant) {
        const ans = await sessionRepository.getParticipantAnswer(participant.id, currentQ.id);
        if (ans) {
          hasAnsweredCurrent = true;
          selectedOption = ans.selectedOption;
        }
      }
    } else if (currentQ && session.status === SessionStatus.QUESTION_CLOSED) {
      const stats = await sessionRepository.getQuestionStats(currentQ.id);
      let isCorrect: boolean | undefined = undefined;
      let pointsAwarded: number | undefined = undefined;

      if (participant) {
        const ans = await sessionRepository.getParticipantAnswer(participant.id, currentQ.id);
        if (ans) {
          isCorrect = ans.isCorrect;
          pointsAwarded = ans.pointsAwarded;
          selectedOption = ans.selectedOption;
        }
      }

      closedQuestion = {
        questionId: currentQ.id,
        correctAnswer: currentQ.correctAnswer,
        stats,
        isCorrect,
        pointsAwarded,
      };
    }

    let leaderboard: LeaderboardEntry[] | undefined = undefined;
    if (session.status === SessionStatus.QUESTION_CLOSED || session.status === SessionStatus.COMPLETED || isHost) {
      leaderboard = await leaderboardService.getLeaderboard(session.id);
    }

    let myScore: number | undefined = undefined;
    let myRank: number | undefined = undefined;

    if (participant) {
      const currentParticipant = await sessionRepository.findParticipantById(participant.id);
      myScore = currentParticipant ? currentParticipant.score : participant.score;

      if (!leaderboard) {
        leaderboard = await leaderboardService.getLeaderboard(session.id);
      }
      const foundRank = leaderboard.find((l) => l.participantId === participant.id);
      myRank = foundRank ? foundRank.rank : undefined;
    }

    return {
      roomCode: session.roomCode,
      status: session.status,
      quizTitle: session.quiz.title,
      participantCount: session.participants.length,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: questions.length,
      currentQuestion,
      questionDeadline: session.questionDeadline ? new Date(session.questionDeadline).toISOString() : null,
      hasAnsweredCurrent,
      selectedOption,
      closedQuestion,
      leaderboard,
      myScore,
      myRank,
    };
  }

  async reconcileActiveSessionsOnStartup(): Promise<void> {
    const activeSessions = await sessionRepository.findActiveSessionsWithDeadlines();
    const now = Date.now();

    for (const session of activeSessions) {
      if (session.questionDeadline) {
        const deadline = new Date(session.questionDeadline).getTime();
        if (now >= deadline) {
          console.log(`Reconciling expired active session ${session.roomCode} on startup...`);
          await this.closeQuestion(session.roomCode);
        } else {
          console.log(`Rescheduling active session ${session.roomCode} timer on startup...`);
          timerManager.scheduleQuestionTimer(session.roomCode, new Date(session.questionDeadline));
        }
      }
    }
  }
}

export const sessionService = new SessionService();
