import { prisma } from '../config/prisma.js';
import { LeaderboardEntry } from '../types/index.js';

interface ParticipantAggregated {
  participantId: string;
  displayName: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracy: number;
  cumulativeResponseTimeMs: number;
  lastCorrectSubmittedAt: number;
  joinedAt: Date;
}

export class LeaderboardService {
  // In-memory previous snapshots for tracking rank changes across live rounds
  private previousSnapshots = new Map<string, Map<string, number>>();

  async getLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: {
        currentQuestionIndex: true,
        quiz: {
          select: {
            questions: {
              select: { id: true },
            },
          },
        },
        participants: {
          select: {
            id: true,
            displayName: true,
            score: true,
            joinedAt: true,
            answers: {
              select: {
                questionId: true,
                isCorrect: true,
                pointsAwarded: true,
                responseTimeMs: true,
                submittedAt: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return [];
    }

    const totalQuestions = session.quiz.questions.length;

    // Aggregate participant data
    const aggregated: ParticipantAggregated[] = session.participants.map((p) => {
      const correctAnswers = p.answers.filter((a) => a.isCorrect);
      const correctCount = correctAnswers.length;
      const incorrectCount = p.answers.filter((a) => !a.isCorrect).length;
      const totalAnswered = p.answers.length;
      const unansweredCount = Math.max(0, totalQuestions - totalAnswered);

      const accuracy = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 1000) / 10
        : 0;

      const cumulativeResponseTimeMs = correctAnswers.reduce(
        (sum, a) => sum + (a.responseTimeMs ?? 0),
        0
      );

      const lastCorrectSubmittedAt = correctAnswers.reduce(
        (latest, a) => Math.max(latest, a.submittedAt.getTime()),
        0
      );

      return {
        participantId: p.id,
        displayName: p.displayName,
        score: p.score,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracy,
        cumulativeResponseTimeMs,
        lastCorrectSubmittedAt,
        joinedAt: p.joinedAt,
      };
    });

    // Deterministic ranking rule:
    // 1. Total score descending
    // 2. Correct answer count descending
    // 3. Cumulative response time for correct answers ascending
    // 4. Earlier achievement of final tied score ascending (or join timestamp)
    // 5. Stable final tie-break: participant ID
    aggregated.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      if (a.cumulativeResponseTimeMs !== b.cumulativeResponseTimeMs) {
        return a.cumulativeResponseTimeMs - b.cumulativeResponseTimeMs;
      }
      if (a.lastCorrectSubmittedAt !== b.lastCorrectSubmittedAt) {
        return a.lastCorrectSubmittedAt - b.lastCorrectSubmittedAt;
      }
      if (a.joinedAt.getTime() !== b.joinedAt.getTime()) {
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      }
      return a.participantId.localeCompare(b.participantId);
    });

    const previousRanks = this.previousSnapshots.get(sessionId);
    const newSnapshot = new Map<string, number>();

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < aggregated.length; i++) {
      const current = aggregated[i];
      let rank = i + 1;

      // Handle identical ties honestly
      if (i > 0) {
        const prev = aggregated[i - 1];
        const isIdentical =
          prev.score === current.score &&
          prev.correctCount === current.correctCount &&
          prev.cumulativeResponseTimeMs === current.cumulativeResponseTimeMs &&
          prev.lastCorrectSubmittedAt === current.lastCorrectSubmittedAt;

        if (isIdentical) {
          rank = leaderboard[i - 1].rank;
        }
      }

      newSnapshot.set(current.participantId, rank);

      let rankChange = 0;
      if (previousRanks && previousRanks.has(current.participantId)) {
        const prevRank = previousRanks.get(current.participantId)!;
        rankChange = prevRank - rank; // positive means moved up (e.g. from 3 to 1 -> +2)
      }

      leaderboard.push({
        participantId: current.participantId,
        displayName: current.displayName,
        score: current.score,
        rank,
        correctCount: current.correctCount,
        incorrectCount: current.incorrectCount,
        unansweredCount: current.unansweredCount,
        accuracy: current.accuracy,
        cumulativeResponseTimeMs: current.cumulativeResponseTimeMs,
        rankChange,
      });
    }

    // Save updated snapshot
    this.previousSnapshots.set(sessionId, newSnapshot);

    return leaderboard;
  }

  clearSession(sessionId: string): void {
    this.previousSnapshots.delete(sessionId);
  }
}

export const leaderboardService = new LeaderboardService();
