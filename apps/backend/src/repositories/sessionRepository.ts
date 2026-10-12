import { QuizSession, SessionStatus, Participant, Answer, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { LeaderboardEntry, AnswerStats } from '../types/index.js';

export type SessionWithQuizAndQuestions = QuizSession & {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    hostId: string;
    questions: {
      id: string;
      text: string;
      options: Prisma.JsonValue;
      correctAnswer: number;
      points: number;
      timeLimitSeconds: number;
      orderIndex: number;
    }[];
  };
  participants: Participant[];
};

export class SessionRepository {
  async createSession(quizId: string, roomCode: string): Promise<QuizSession> {
    return prisma.quizSession.create({
      data: {
        quizId,
        roomCode,
        status: SessionStatus.WAITING,
        currentQuestionIndex: 0,
      },
    });
  }

  async findByRoomCode(roomCode: string): Promise<SessionWithQuizAndQuestions | null> {
    return prisma.quizSession.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            hostId: true,
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                points: true,
                timeLimitSeconds: true,
                orderIndex: true,
              },
            },
          },
        },
        participants: {
          orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });
  }

  async findById(id: string): Promise<SessionWithQuizAndQuestions | null> {
    return prisma.quizSession.findUnique({
      where: { id },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            hostId: true,
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                points: true,
                timeLimitSeconds: true,
                orderIndex: true,
              },
            },
          },
        },
        participants: {
          orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });
  }

  async updateSession(
    sessionId: string,
    data: {
      status?: SessionStatus;
      currentQuestionIndex?: number;
      questionDeadline?: Date | null;
      startedAt?: Date | null;
      endedAt?: Date | null;
    }
  ): Promise<QuizSession> {
    return prisma.quizSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async addParticipant(sessionId: string, displayName: string, joinTokenHash: string): Promise<Participant> {
    return prisma.participant.create({
      data: {
        sessionId,
        displayName: displayName.trim(),
        joinTokenHash,
        score: 0,
      },
    });
  }

  async findParticipantByTokenHash(sessionId: string, joinTokenHash: string): Promise<Participant | null> {
    return prisma.participant.findFirst({
      where: {
        sessionId,
        joinTokenHash,
      },
    });
  }

  async findParticipantById(participantId: string): Promise<Participant | null> {
    return prisma.participant.findUnique({
      where: { id: participantId },
    });
  }

  async findParticipantByName(sessionId: string, displayName: string): Promise<Participant | null> {
    return prisma.participant.findFirst({
      where: {
        sessionId,
        displayName: displayName.trim(),
      },
    });
  }

  async getParticipantCount(sessionId: string): Promise<number> {
    return prisma.participant.count({
      where: { sessionId },
    });
  }

  async hasParticipantAnswered(participantId: string, questionId: string): Promise<boolean> {
    const existing = await prisma.answer.findUnique({
      where: {
        participantId_questionId: {
          participantId,
          questionId,
        },
      },
    });
    return existing !== null;
  }

  async getParticipantAnswer(participantId: string, questionId: string): Promise<Answer | null> {
    return prisma.answer.findUnique({
      where: {
        participantId_questionId: {
          participantId,
          questionId,
        },
      },
    });
  }

  async recordAnswer(data: {
    participantId: string;
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
    pointsAwarded: number;
    submissionId: string;
    responseTimeMs?: number | null;
  }): Promise<Answer> {
    return prisma.$transaction(async (tx) => {
      const answer = await tx.answer.create({
        data: {
          participantId: data.participantId,
          questionId: data.questionId,
          selectedOption: data.selectedOption,
          isCorrect: data.isCorrect,
          pointsAwarded: data.pointsAwarded,
          submissionId: data.submissionId,
          responseTimeMs: data.responseTimeMs,
        },
      });

      if (data.isCorrect && data.pointsAwarded > 0) {
        await tx.participant.update({
          where: { id: data.participantId },
          data: {
            score: {
              increment: data.pointsAwarded,
            },
          },
        });
      }

      return answer;
    });
  }

  async getQuestionStats(questionId: string): Promise<AnswerStats> {
    const answers = await prisma.answer.findMany({
      where: { questionId },
      select: { selectedOption: true },
    });

    const stats: AnswerStats = {
      option0: 0,
      option1: 0,
      option2: 0,
      option3: 0,
      totalAnswered: answers.length,
    };

    for (const a of answers) {
      if (a.selectedOption === 0) stats.option0++;
      else if (a.selectedOption === 1) stats.option1++;
      else if (a.selectedOption === 2) stats.option2++;
      else if (a.selectedOption === 3) stats.option3++;
    }

    return stats;
  }

  async getLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
    const participants = await prisma.participant.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
      select: {
        id: true,
        displayName: true,
        score: true,
      },
    });

    return participants.map((p, index) => ({
      participantId: p.id,
      displayName: p.displayName,
      score: p.score,
      rank: index + 1,
    }));
  }

  async findActiveSessionsWithDeadlines(): Promise<QuizSession[]> {
    return prisma.quizSession.findMany({
      where: {
        status: SessionStatus.QUESTION_ACTIVE,
        questionDeadline: { not: null },
      },
    });
  }
}

export const sessionRepository = new SessionRepository();
