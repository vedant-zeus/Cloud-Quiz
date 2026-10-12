import { prisma } from '../config/prisma.js';
import {
  DetailedQuestionAnalytics,
  CompetitionAnalytics,
  ParticipantResult,
  HistoricalCompetitionSummary,
  OptionDistribution,
  PaginatedResult,
} from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { leaderboardService } from './leaderboardService.js';

export class AnalyticsService {
  /**
   * Calculate detailed question statistics for a single question within a session.
   */
  async getQuestionAnalytics(
    sessionId: string,
    questionId: string,
    isQuestionClosed: boolean = true
  ): Promise<DetailedQuestionAnalytics> {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        quiz: {
          select: {
            questions: {
              where: { id: questionId },
              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                points: true,
                orderIndex: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.quiz.questions.length) {
      throw new NotFoundError('Question not found in session');
    }

    const question = session.quiz.questions[0];
    const options = (question.options as string[]) || [];

    const [totalParticipants, answers] = await Promise.all([
      prisma.participant.count({ where: { sessionId } }),
      prisma.answer.findMany({
        where: {
          questionId,
          participant: { sessionId },
        },
        select: {
          selectedOption: true,
          isCorrect: true,
          pointsAwarded: true,
          responseTimeMs: true,
        },
      }),
    ]);

    const submittedAnswers = answers.length;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const incorrectAnswers = answers.filter((a) => !a.isCorrect).length;
    const unansweredCount = Math.max(0, totalParticipants - submittedAnswers);

    // Accuracy: percentage of submitted answers that were correct
    const accuracyPercentage =
      submittedAnswers > 0
        ? Math.round((correctAnswers / submittedAnswers) * 1000) / 10
        : 0;

    // Option distribution for options 0..3
    const optionCounts = [0, 0, 0, 0];
    for (const a of answers) {
      if (a.selectedOption >= 0 && a.selectedOption <= 3) {
        optionCounts[a.selectedOption]++;
      }
    }

    const optionDistribution: OptionDistribution[] = options.map((text, idx) => ({
      optionIndex: idx,
      text,
      count: optionCounts[idx] || 0,
      percentage:
        submittedAnswers > 0
          ? Math.round(((optionCounts[idx] || 0) / submittedAnswers) * 1000) / 10
          : 0,
    }));

    // Response time calculations
    const answersWithTime = answers.filter(
      (a) => typeof a.responseTimeMs === 'number' && a.responseTimeMs >= 0
    );
    const sumTime = answersWithTime.reduce((acc, a) => acc + (a.responseTimeMs ?? 0), 0);
    const averageResponseTimeMs =
      answersWithTime.length > 0 ? Math.round(sumTime / answersWithTime.length) : 0;

    const responseTimeDistribution = {
      under5s: 0,
      between5and10s: 0,
      between10and15s: 0,
      over15s: 0,
    };

    for (const a of answersWithTime) {
      const timeMs = a.responseTimeMs ?? 0;
      if (timeMs < 5000) {
        responseTimeDistribution.under5s++;
      } else if (timeMs < 10000) {
        responseTimeDistribution.between5and10s++;
      } else if (timeMs < 15000) {
        responseTimeDistribution.between10and15s++;
      } else {
        responseTimeDistribution.over15s++;
      }
    }

    return {
      questionId: question.id,
      questionNumber: question.orderIndex + 1,
      text: question.text,
      options,
      correctAnswer: isQuestionClosed ? question.correctAnswer : undefined,
      points: question.points,
      totalParticipants,
      submittedAnswers,
      correctAnswers,
      incorrectAnswers,
      unansweredCount,
      accuracyPercentage,
      optionDistribution,
      averageResponseTimeMs,
      responseTimeDistribution,
    };
  }

  /**
   * Calculate authoritative competition-level analytics for a completed competition.
   */
  async getCompetitionAnalytics(sessionId: string): Promise<CompetitionAnalytics> {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                points: true,
                orderIndex: true,
              },
            },
          },
        },
        participants: {
          select: {
            id: true,
            displayName: true,
            score: true,
            answers: {
              select: {
                questionId: true,
                selectedOption: true,
                isCorrect: true,
                pointsAwarded: true,
                responseTimeMs: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Competition session not found');
    }

    const totalParticipants = session.participants.length;
    const participantsWithAnswers = session.participants.filter(
      (p) => p.answers.length > 0
    ).length;

    const participationRate =
      totalParticipants > 0
        ? Math.round((participantsWithAnswers / totalParticipants) * 1000) / 10
        : 0;

    const totalQuestions = session.quiz.questions.length;

    // Collect all answers across participants
    const allAnswers = session.participants.flatMap((p) => p.answers);
    const totalAnswers = allAnswers.length;
    const correctAnswers = allAnswers.filter((a) => a.isCorrect).length;
    const incorrectAnswers = allAnswers.filter((a) => !a.isCorrect).length;

    const overallAccuracy =
      totalAnswers > 0
        ? Math.round((correctAnswers / totalAnswers) * 1000) / 10
        : 0;

    const answersWithTime = allAnswers.filter(
      (a) => typeof a.responseTimeMs === 'number' && a.responseTimeMs >= 0
    );
    const sumTime = answersWithTime.reduce((acc, a) => acc + (a.responseTimeMs ?? 0), 0);
    const meanResponseTimeMs =
      answersWithTime.length > 0 ? Math.round(sumTime / answersWithTime.length) : 0;

    // Score metrics
    const scores = session.participants.map((p) => p.score).sort((a, b) => a - b);
    const highestScore = scores.length > 0 ? scores[scores.length - 1] : 0;

    let medianScore = 0;
    if (scores.length > 0) {
      const mid = Math.floor(scores.length / 2);
      medianScore =
        scores.length % 2 !== 0
          ? scores[mid]
          : Math.round((scores[mid - 1] + scores[mid]) / 2);
    }

    // Score distribution brackets
    const scoreDistribution = [
      { bracket: '0 pts', count: 0 },
      { bracket: '1 - 100 pts', count: 0 },
      { bracket: '101 - 250 pts', count: 0 },
      { bracket: '251 - 500 pts', count: 0 },
      { bracket: '501+ pts', count: 0 },
    ];

    for (const score of scores) {
      if (score === 0) scoreDistribution[0].count++;
      else if (score <= 100) scoreDistribution[1].count++;
      else if (score <= 250) scoreDistribution[2].count++;
      else if (score <= 500) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }

    // Per-question stats
    const perQuestionStats: DetailedQuestionAnalytics[] = [];
    const performanceTrends: Array<{
      questionNumber: number;
      accuracyPercentage: number;
      averageResponseTimeMs: number;
    }> = [];

    for (const q of session.quiz.questions) {
      const qAnswers = allAnswers.filter((a) => a.questionId === q.id);
      const qSubmissions = qAnswers.length;
      const qCorrect = qAnswers.filter((a) => a.isCorrect).length;
      const qIncorrect = qAnswers.filter((a) => !a.isCorrect).length;
      const qUnanswered = Math.max(0, totalParticipants - qSubmissions);

      const qAccuracy =
        qSubmissions > 0
          ? Math.round((qCorrect / qSubmissions) * 1000) / 10
          : 0;

      const qAnswersWithTime = qAnswers.filter(
        (a) => typeof a.responseTimeMs === 'number' && a.responseTimeMs >= 0
      );
      const qSumTime = qAnswersWithTime.reduce(
        (acc, a) => acc + (a.responseTimeMs ?? 0),
        0
      );
      const qAvgTime =
        qAnswersWithTime.length > 0
          ? Math.round(qSumTime / qAnswersWithTime.length)
          : 0;

      const qOpts = (q.options as string[]) || [];
      const qOptCounts = [0, 0, 0, 0];
      for (const a of qAnswers) {
        if (a.selectedOption >= 0 && a.selectedOption <= 3) {
          qOptCounts[a.selectedOption]++;
        }
      }

      const qDistribution: OptionDistribution[] = qOpts.map((text, idx) => ({
        optionIndex: idx,
        text,
        count: qOptCounts[idx] || 0,
        percentage:
          qSubmissions > 0
            ? Math.round(((qOptCounts[idx] || 0) / qSubmissions) * 1000) / 10
            : 0,
      }));

      const qTimeDistribution = {
        under5s: 0,
        between5and10s: 0,
        between10and15s: 0,
        over15s: 0,
      };

      for (const a of qAnswersWithTime) {
        const timeMs = a.responseTimeMs ?? 0;
        if (timeMs < 5000) qTimeDistribution.under5s++;
        else if (timeMs < 10000) qTimeDistribution.between5and10s++;
        else if (timeMs < 15000) qTimeDistribution.between10and15s++;
        else qTimeDistribution.over15s++;
      }

      const qAnalytics: DetailedQuestionAnalytics = {
        questionId: q.id,
        questionNumber: q.orderIndex + 1,
        text: q.text,
        options: qOpts,
        correctAnswer: q.correctAnswer,
        points: q.points,
        totalParticipants,
        submittedAnswers: qSubmissions,
        correctAnswers: qCorrect,
        incorrectAnswers: qIncorrect,
        unansweredCount: qUnanswered,
        accuracyPercentage: qAccuracy,
        optionDistribution: qDistribution,
        averageResponseTimeMs: qAvgTime,
        responseTimeDistribution: qTimeDistribution,
      };

      perQuestionStats.push(qAnalytics);
      performanceTrends.push({
        questionNumber: q.orderIndex + 1,
        accuracyPercentage: qAccuracy,
        averageResponseTimeMs: qAvgTime,
      });
    }

    // Identify challenging and easiest questions
    let mostChallengingQuestion: CompetitionAnalytics['mostChallengingQuestion'] = null;
    let easiestQuestion: CompetitionAnalytics['easiestQuestion'] = null;

    if (perQuestionStats.length > 0) {
      const sortedByAccuracy = [...perQuestionStats].sort(
        (a, b) => a.accuracyPercentage - b.accuracyPercentage
      );
      const hardest = sortedByAccuracy[0];
      const easiest = sortedByAccuracy[sortedByAccuracy.length - 1];

      mostChallengingQuestion = {
        id: hardest.questionId,
        questionNumber: hardest.questionNumber,
        text: hardest.text,
        accuracyPercentage: hardest.accuracyPercentage,
      };

      easiestQuestion = {
        id: easiest.questionId,
        questionNumber: easiest.questionNumber,
        text: easiest.text,
        accuracyPercentage: easiest.accuracyPercentage,
      };
    }

    return {
      sessionId: session.id,
      quizTitle: session.quiz.title,
      quizId: session.quiz.id,
      roomCode: session.roomCode,
      status: session.status,
      startedAt: session.startedAt?.toISOString() || null,
      endedAt: session.endedAt?.toISOString() || null,
      totalParticipants,
      activeParticipants: participantsWithAnswers,
      participationRate,
      totalQuestions,
      totalAnswers,
      correctAnswers,
      incorrectAnswers,
      overallAccuracy,
      meanResponseTimeMs,
      highestScore,
      medianScore,
      scoreDistribution,
      perQuestionStats,
      mostChallengingQuestion,
      easiestQuestion,
      performanceTrends,
    };
  }

  /**
   * Get personalized participant results for their review screen.
   */
  async getParticipantResults(
    sessionId: string,
    participantId: string
  ): Promise<ParticipantResult> {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                points: true,
                orderIndex: true,
              },
            },
          },
        },
        participants: {
          where: { id: participantId },
          include: {
            answers: true,
          },
        },
      },
    });

    if (!session || !session.participants.length) {
      throw new NotFoundError('Participant or session not found');
    }

    const participant = session.participants[0];
    const totalQuestions = session.quiz.questions.length;

    // Fetch authoritative leaderboard for exact rank
    const leaderboard = await leaderboardService.getLeaderboard(sessionId);
    const myEntry = leaderboard.find((p) => p.participantId === participantId);
    const rank = myEntry?.rank ?? 1;

    const correctAnswers = participant.answers.filter((a) => a.isCorrect);
    const correctCount = correctAnswers.length;
    const incorrectCount = participant.answers.filter((a) => !a.isCorrect).length;
    const unansweredCount = Math.max(0, totalQuestions - participant.answers.length);

    const accuracy =
      participant.answers.length > 0
        ? Math.round((correctCount / participant.answers.length) * 1000) / 10
        : 0;

    const answersWithTime = participant.answers.filter(
      (a) => typeof a.responseTimeMs === 'number' && a.responseTimeMs >= 0
    );
    const sumTime = answersWithTime.reduce((acc, a) => acc + (a.responseTimeMs ?? 0), 0);
    const averageResponseTimeMs =
      answersWithTime.length > 0 ? Math.round(sumTime / answersWithTime.length) : 0;

    // Build question-by-question breakdown
    const isSessionEnded = session.status === 'COMPLETED';
    const questionsBreakdown = session.quiz.questions.map((q) => {
      const userAns = participant.answers.find((a) => a.questionId === q.id);
      return {
        questionId: q.id,
        questionNumber: q.orderIndex + 1,
        text: q.text,
        options: (q.options as string[]) || [],
        selectedOption: userAns !== undefined ? userAns.selectedOption : null,
        isCorrect: userAns !== undefined ? userAns.isCorrect : null,
        pointsAwarded: userAns !== undefined ? userAns.pointsAwarded : 0,
        responseTimeMs: userAns?.responseTimeMs ?? null,
        // Only reveal correct answer after session completes or question is closed
        correctAnswer: isSessionEnded ? q.correctAnswer : null,
        points: q.points,
      };
    });

    return {
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        rank,
        score: participant.score,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracy,
        averageResponseTimeMs,
      },
      questions: questionsBreakdown,
      leaderboard: leaderboard.slice(0, 10), // Top 10 for participant podium
    };
  }

  /**
   * List historical competitions owned by the authenticated host.
   */
  async getHistoricalCompetitions(
    hostId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      status?: string;
    }
  ): Promise<PaginatedResult<HistoricalCompetitionSummary>> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      quiz: { hostId },
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.search) {
      where.OR = [
        { roomCode: { contains: options.search.trim().toUpperCase() } },
        { quiz: { title: { contains: options.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [total, sessions] = await Promise.all([
      prisma.quizSession.count({ where }),
      prisma.quizSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
          participants: {
            select: {
              score: true,
            },
          },
        },
      }),
    ]);

    const items: HistoricalCompetitionSummary[] = sessions.map((s) => {
      const highestScore = s.participants.reduce(
        (max, p) => Math.max(max, p.score),
        0
      );

      return {
        sessionId: s.id,
        quizId: s.quiz.id,
        quizTitle: s.quiz.title,
        roomCode: s.roomCode,
        status: s.status,
        startedAt: s.startedAt?.toISOString() || null,
        endedAt: s.endedAt?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        participantCount: s.participants.length,
        highestScore,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Export Leaderboard CSV with formula injection protection.
   */
  async exportLeaderboardCsv(sessionId: string): Promise<string> {
    const leaderboard = await leaderboardService.getLeaderboard(sessionId);

    const headers = [
      'Rank',
      'Participant Name',
      'Total Score',
      'Correct Answers',
      'Incorrect Answers',
      'Unanswered',
      'Accuracy (%)',
      'Cumulative Response Time (s)',
    ];

    const rows = leaderboard.map((entry) => [
      entry.rank,
      this.sanitizeCsv(entry.displayName),
      entry.score,
      entry.correctCount ?? 0,
      entry.incorrectCount ?? 0,
      entry.unansweredCount ?? 0,
      entry.accuracy ?? 0,
      entry.cumulativeResponseTimeMs
        ? (entry.cumulativeResponseTimeMs / 1000).toFixed(2)
        : '0.00',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * Export detailed Answer Submissions CSV with formula injection protection.
   */
  async exportAnswersCsv(sessionId: string): Promise<string> {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          select: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                orderIndex: true,
                text: true,
              },
            },
          },
        },
        participants: {
          orderBy: { displayName: 'asc' },
          select: {
            id: true,
            displayName: true,
            answers: {
              orderBy: { submittedAt: 'asc' },
              select: {
                questionId: true,
                selectedOption: true,
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
      throw new NotFoundError('Session not found for answer export');
    }

    const questionMap = new Map<string, { number: number; text: string }>();
    session.quiz.questions.forEach((q) => {
      questionMap.set(q.id, { number: q.orderIndex + 1, text: q.text });
    });

    const headers = [
      'Participant Name',
      'Question Number',
      'Question Text',
      'Selected Option',
      'Is Correct',
      'Points Awarded',
      'Response Time (s)',
      'Submission Timestamp',
    ];

    const rows: string[] = [];

    for (const p of session.participants) {
      for (const a of p.answers) {
        const qInfo = questionMap.get(a.questionId) || { number: 0, text: 'Unknown' };
        const optionLetter = String.fromCharCode(65 + a.selectedOption);
        const responseTimeSec = a.responseTimeMs
          ? (a.responseTimeMs / 1000).toFixed(2)
          : 'N/A';

        rows.push(
          [
            this.sanitizeCsv(p.displayName),
            qInfo.number,
            this.sanitizeCsv(qInfo.text),
            optionLetter,
            a.isCorrect ? 'TRUE' : 'FALSE',
            a.pointsAwarded,
            responseTimeSec,
            a.submittedAt.toISOString(),
          ].join(',')
        );
      }
    }

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Formula injection sanitization and CSV character escaping.
   */
  private sanitizeCsv(value: unknown): string {
    if (value === null || value === undefined) return '""';
    let str = String(value).trim();

    // Prevent CSV formula injection by prepending apostrophe if starting with dangerous symbols
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape quotes and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }
}

export const analyticsService = new AnalyticsService();
