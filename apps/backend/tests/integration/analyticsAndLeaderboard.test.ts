import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { cleanDatabase } from '../setup.js';
import { prisma } from '../../src/config/prisma.js';
import { leaderboardService } from '../../src/services/leaderboardService.js';
import { analyticsService } from '../../src/services/analyticsService.js';
import { generateParticipantToken, hashParticipantToken } from '../../src/utils/token.js';

describe('Phase 3: Leaderboard, Analytics, History, and CSV Exports', () => {
  let hostAToken: string;
  let hostBToken: string;
  let quizId: string;
  let q1Id: string;
  let q2Id: string;
  let sessionId: string;
  let roomCode: string;

  beforeEach(async () => {
    await cleanDatabase();

    // 1. Register Host A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Alice',
      email: 'alice.phase3@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostAToken = resA.body.data.token;

    // 2. Register Host B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Bob',
      email: 'bob.phase3@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostBToken = resB.body.data.token;

    // 3. Create Quiz with 2 Questions
    const quizRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Tech Symposium Final' });
    quizId = quizRes.body.data.quiz.id;

    const q1Res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'What does HTTP stand for?',
        options: ['HyperText Transfer Protocol', 'High Text Tool Protocol', 'Hyper Transfer Task Program', 'High Task Tech Pack'],
        correctAnswer: 0,
        points: 100,
        timeLimitSeconds: 20,
      });
    q1Id = q1Res.body.data.question.id;

    const q2Res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Which data structure follows FIFO?',
        options: ['Stack', 'Queue', 'Binary Tree', 'Graph'],
        correctAnswer: 1,
        points: 200,
        timeLimitSeconds: 25,
      });
    q2Id = q2Res.body.data.question.id;

    // Publish Quiz
    await request(app)
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${hostAToken}`);

    // Create Live Session
    const sessRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ quizId });
    sessionId = sessRes.body.data.session.id;
    roomCode = sessRes.body.data.session.roomCode;
  });

  describe('Feature A: Authoritative Leaderboard & Ranking Rules', () => {
    it('ranks participants by score descending, breaking ties by correct count and response time', async () => {
      // Create 3 participants with specific scores and response times
      // P1: Score 200 (2 correct answers, total response time 8000ms)
      const p1 = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Player One',
          joinTokenHash: hashParticipantToken('token-1'),
          score: 200,
          joinedAt: new Date(Date.now() - 5000),
        },
      });
      await prisma.answer.createMany({
        data: [
          {
            participantId: p1.id,
            questionId: q1Id,
            selectedOption: 0,
            isCorrect: true,
            pointsAwarded: 100,
            responseTimeMs: 3000,
            submissionId: 'sub-p1-q1',
            submittedAt: new Date(Date.now() - 4000),
          },
          {
            participantId: p1.id,
            questionId: q2Id,
            selectedOption: 1,
            isCorrect: true,
            pointsAwarded: 100,
            responseTimeMs: 5000,
            submissionId: 'sub-p1-q2',
            submittedAt: new Date(Date.now() - 2000),
          },
        ],
      });

      // P2: Score 200 (1 correct answer of 200 points, total response time 4000ms)
      // Tied in score with P1, but P1 has 2 correct answers while P2 has 1. P1 must rank higher!
      const p2 = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Player Two',
          joinTokenHash: hashParticipantToken('token-2'),
          score: 200,
          joinedAt: new Date(Date.now() - 4000),
        },
      });
      await prisma.answer.create({
        data: {
          participantId: p2.id,
          questionId: q2Id,
          selectedOption: 1,
          isCorrect: true,
          pointsAwarded: 200,
          responseTimeMs: 4000,
          submissionId: 'sub-p2-q2',
          submittedAt: new Date(Date.now() - 1000),
        },
      });

      // P3: Zero answers submitted
      const p3 = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Player Three',
          joinTokenHash: hashParticipantToken('token-3'),
          score: 0,
          joinedAt: new Date(Date.now() - 3000),
        },
      });

      const leaderboard = await leaderboardService.getLeaderboard(sessionId);

      expect(leaderboard.length).toBe(3);
      // P1 ranked #1 because 2 correct answers beats 1 correct answer on tied 200 score
      expect(leaderboard[0].participantId).toBe(p1.id);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].correctCount).toBe(2);
      expect(leaderboard[0].accuracy).toBe(100);

      // P2 ranked #2
      expect(leaderboard[1].participantId).toBe(p2.id);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].correctCount).toBe(1);

      // P3 ranked #3 with 0 score and 0 accuracy without dividing by zero
      expect(leaderboard[2].participantId).toBe(p3.id);
      expect(leaderboard[2].rank).toBe(3);
      expect(leaderboard[2].score).toBe(0);
      expect(leaderboard[2].accuracy).toBe(0);
      expect(leaderboard[2].unansweredCount).toBe(2);
    });

    it('breaks tied scores and correct counts using faster cumulative response time', async () => {
      // Both P_Fast and P_Slow have 100 points and 1 correct answer
      // P_Fast took 2000ms; P_Slow took 7000ms
      const pFast = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Fast Player',
          joinTokenHash: hashParticipantToken('token-fast'),
          score: 100,
        },
      });
      await prisma.answer.create({
        data: {
          participantId: pFast.id,
          questionId: q1Id,
          selectedOption: 0,
          isCorrect: true,
          pointsAwarded: 100,
          responseTimeMs: 2000,
          submissionId: 'sub-fast-1',
        },
      });

      const pSlow = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Slow Player',
          joinTokenHash: hashParticipantToken('token-slow'),
          score: 100,
        },
      });
      await prisma.answer.create({
        data: {
          participantId: pSlow.id,
          questionId: q1Id,
          selectedOption: 0,
          isCorrect: true,
          pointsAwarded: 100,
          responseTimeMs: 7000,
          submissionId: 'sub-slow-1',
        },
      });

      const leaderboard = await leaderboardService.getLeaderboard(sessionId);

      expect(leaderboard[0].participantId).toBe(pFast.id);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].cumulativeResponseTimeMs).toBe(2000);

      expect(leaderboard[1].participantId).toBe(pSlow.id);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].cumulativeResponseTimeMs).toBe(7000);
    });
  });

  describe('Feature B: Question Analytics', () => {
    it('calculates accurate accuracy, unanswered counts, and option distributions', async () => {
      // 3 participants in session
      const p1 = await prisma.participant.create({
        data: { sessionId, displayName: 'User 1', joinTokenHash: 'h1', score: 100 },
      });
      const p2 = await prisma.participant.create({
        data: { sessionId, displayName: 'User 2', joinTokenHash: 'h2', score: 0 },
      });
      await prisma.participant.create({
        data: { sessionId, displayName: 'User 3', joinTokenHash: 'h3', score: 0 },
      });

      // P1 chose option 0 (correct), response time 4000ms
      await prisma.answer.create({
        data: {
          participantId: p1.id,
          questionId: q1Id,
          selectedOption: 0,
          isCorrect: true,
          pointsAwarded: 100,
          responseTimeMs: 4000,
          submissionId: 'sub-q-1',
        },
      });

      // P2 chose option 1 (incorrect), response time 8000ms
      await prisma.answer.create({
        data: {
          participantId: p2.id,
          questionId: q1Id,
          selectedOption: 1,
          isCorrect: false,
          pointsAwarded: 0,
          responseTimeMs: 8000,
          submissionId: 'sub-q-2',
        },
      });

      // P3 did not answer Q1

      const stats = await analyticsService.getQuestionAnalytics(sessionId, q1Id, true);

      expect(stats.totalParticipants).toBe(3);
      expect(stats.submittedAnswers).toBe(2);
      expect(stats.correctAnswers).toBe(1);
      expect(stats.incorrectAnswers).toBe(1);
      expect(stats.unansweredCount).toBe(1);
      // Accuracy = 1 / 2 * 100 = 50%
      expect(stats.accuracyPercentage).toBe(50);
      expect(stats.averageResponseTimeMs).toBe(6000); // (4000 + 8000) / 2
      expect(stats.correctAnswer).toBe(0);

      // Verify option distribution
      expect(stats.optionDistribution[0].count).toBe(1);
      expect(stats.optionDistribution[0].percentage).toBe(50);
      expect(stats.optionDistribution[1].count).toBe(1);
      expect(stats.optionDistribution[1].percentage).toBe(50);
      expect(stats.optionDistribution[2].count).toBe(0);
      expect(stats.optionDistribution[3].count).toBe(0);
    });
  });

  describe('Feature C: Competition-Level Analytics & REST APIs', () => {
    beforeEach(async () => {
      // Mark session as COMPLETED with timestamps
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 60000),
          endedAt: new Date(),
        },
      });

      const p1 = await prisma.participant.create({
        data: { sessionId, displayName: 'Top Winner', joinTokenHash: 'h-win', score: 300 },
      });
      const p2 = await prisma.participant.create({
        data: { sessionId, displayName: 'Runner Up', joinTokenHash: 'h-run', score: 100 },
      });

      await prisma.answer.createMany({
        data: [
          {
            participantId: p1.id,
            questionId: q1Id,
            selectedOption: 0,
            isCorrect: true,
            pointsAwarded: 100,
            responseTimeMs: 3000,
            submissionId: 'sub-c-1',
          },
          {
            participantId: p1.id,
            questionId: q2Id,
            selectedOption: 1,
            isCorrect: true,
            pointsAwarded: 200,
            responseTimeMs: 5000,
            submissionId: 'sub-c-2',
          },
          {
            participantId: p2.id,
            questionId: q1Id,
            selectedOption: 0,
            isCorrect: true,
            pointsAwarded: 100,
            responseTimeMs: 6000,
            submissionId: 'sub-c-3',
          },
          {
            participantId: p2.id,
            questionId: q2Id,
            selectedOption: 0,
            isCorrect: false,
            pointsAwarded: 0,
            responseTimeMs: 7000,
            submissionId: 'sub-c-4',
          },
        ],
      });
    });

    it('returns competition analytics for authenticated owner (GET /api/v1/sessions/:roomCode/analytics)', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/analytics`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(res.status).toBe(200);
      const analytics = res.body.data.analytics;
      expect(analytics.totalParticipants).toBe(2);
      expect(analytics.activeParticipants).toBe(2);
      expect(analytics.participationRate).toBe(100);
      expect(analytics.totalQuestions).toBe(2);
      expect(analytics.totalAnswers).toBe(4);
      expect(analytics.correctAnswers).toBe(3);
      expect(analytics.incorrectAnswers).toBe(1);
      expect(analytics.overallAccuracy).toBe(75); // 3/4 * 100 = 75%
      expect(analytics.highestScore).toBe(300);
      expect(analytics.medianScore).toBe(200); // average of 100 and 300
      expect(analytics.perQuestionStats.length).toBe(2);
    });

    it('rejects unauthorized host from viewing another host analytics with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/analytics`)
        .set('Authorization', `Bearer ${hostBToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Feature D: Participant Personal Results', () => {
    it('returns personal question breakdown for authenticated participant credential', async () => {
      const pToken = generateParticipantToken();
      const pHash = hashParticipantToken(pToken);

      const p = await prisma.participant.create({
        data: {
          sessionId,
          displayName: 'Participant Reviewer',
          joinTokenHash: pHash,
          score: 100,
        },
      });

      await prisma.answer.create({
        data: {
          participantId: p.id,
          questionId: q1Id,
          selectedOption: 0,
          isCorrect: true,
          pointsAwarded: 100,
          responseTimeMs: 2500,
          submissionId: 'sub-rev-1',
        },
      });

      // Mark session completed
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      });

      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/participant-results`)
        .set('x-participant-token', pToken);

      expect(res.status).toBe(200);
      expect(res.body.data.participant.displayName).toBe('Participant Reviewer');
      expect(res.body.data.participant.score).toBe(100);
      expect(res.body.data.questions.length).toBe(2);
      expect(res.body.data.questions[0].selectedOption).toBe(0);
      expect(res.body.data.questions[0].isCorrect).toBe(true);
      // Correct answer is revealed because session is completed
      expect(res.body.data.questions[0].correctAnswer).toBe(0);
    });

    it('rejects request without participant credentials with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/sessions/${roomCode}/participant-results`);
      expect(res.status).toBe(401);
    });
  });

  describe('Feature F: Historical Competitions API', () => {
    beforeEach(async () => {
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
    });

    it('lists historical competitions for authenticated host (GET /api/v1/history)', async () => {
      const res = await request(app)
        .get('/api/v1/history')
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].quizTitle).toBe('Tech Symposium Final');
      expect(res.body.data.items[0].roomCode).toBe(roomCode);
    });

    it('returns competition details and analytics by ID (GET /api/v1/history/:sessionId)', async () => {
      const res = await request(app)
        .get(`/api/v1/history/${sessionId}`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.session.id).toBe(sessionId);
      expect(res.body.data.analytics).toBeDefined();
      expect(res.body.data.leaderboard).toBeDefined();
    });

    it('prevents Host B from accessing Host A historical competition detail (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/history/${sessionId}`)
        .set('Authorization', `Bearer ${hostBToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Feature G: CSV Exports & Injection Protection', () => {
    beforeEach(async () => {
      // Participant with potential CSV formula injection string
      const dangerousName = '=SUM(1+1)';
      const p = await prisma.participant.create({
        data: {
          sessionId,
          displayName: dangerousName,
          joinTokenHash: 'h-danger',
          score: 100,
        },
      });

      await prisma.answer.create({
        data: {
          participantId: p.id,
          questionId: q1Id,
          selectedOption: 0,
          isCorrect: true,
          pointsAwarded: 100,
          responseTimeMs: 3200,
          submissionId: 'sub-csv-1',
        },
      });
    });

    it('exports sanitized Leaderboard CSV with proper headers and formula protection', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/export/leaderboard.csv`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`attachment; filename="leaderboard-${roomCode}.csv"`);

      // Verify formula injection sanitization: '=SUM(1+1)' escaped to '\'=SUM(1+1)'
      expect(res.text).toContain("'=SUM(1+1)");
      expect(res.text).toContain('Rank,Participant Name,Total Score');
    });

    it('exports Answers CSV with details and correct MIME type', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/export/answers.csv`)
        .set('Authorization', `Bearer ${hostAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`attachment; filename="answers-${roomCode}.csv"`);
      expect(res.text).toContain('Participant Name,Question Number,Question Text');
      expect(res.text).toContain("'=SUM(1+1)");
    });

    it('rejects CSV export for unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/sessions/${roomCode}/export/leaderboard.csv`);
      expect(res.status).toBe(401);
    });

    it('rejects CSV export for non-owner host with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${roomCode}/export/leaderboard.csv`)
        .set('Authorization', `Bearer ${hostBToken}`);
      expect(res.status).toBe(403);
    });
  });
});
