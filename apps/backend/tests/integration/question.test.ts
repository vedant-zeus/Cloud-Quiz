import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { cleanDatabase } from '../setup.js';

describe('Question Management API', () => {
  let hostAToken: string;
  let hostBToken: string;
  let quizId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Host One',
      email: 'host1@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostAToken = resA.body.data.token;

    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Two',
      email: 'host2@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostBToken = resB.body.data.token;

    const qRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Microservices Quiz' });
    quizId = qRes.body.data.quiz.id;
  });

  it('adds a valid question to a quiz', async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'What protocol does gRPC use primarily?',
        options: ['HTTP/1.1', 'HTTP/2', 'WebSockets', 'FTP'],
        correctAnswer: 1,
        points: 150,
        timeLimitSeconds: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.question.text).toBe('What protocol does gRPC use primarily?');
    expect(res.body.data.question.orderIndex).toBe(0);
    expect(res.body.data.question.points).toBe(150);
  });

  it('rejects questions with fewer or more than 4 options (400)', async () => {
    // 3 options
    const res3 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Invalid options count',
        options: ['Opt 1', 'Opt 2', 'Opt 3'],
        correctAnswer: 0,
      });

    expect(res3.status).toBe(400);

    // 5 options
    const res5 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Invalid options count',
        options: ['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4', 'Opt 5'],
        correctAnswer: 0,
      });

    expect(res5.status).toBe(400);
  });

  it('rejects an invalid correct-answer index', async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Out of bounds answer index',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 4, // Must be 0..3
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid points and time limits', async () => {
    // Points < 1
    const resZeroPoints = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Invalid points',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        points: 0,
      });
    expect(resZeroPoints.status).toBe(400);

    // Time limit < 5 seconds
    const resLowTime = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Too fast time limit',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        timeLimitSeconds: 2,
      });
    expect(resLowTime.status).toBe(400);
  });

  it('edits an existing question', async () => {
    const addRes = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Initial question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
      });
    const questionId = addRes.body.data.question.id;

    const editRes = await request(app)
      .patch(`/api/v1/quizzes/${quizId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Updated question title',
        points: 200,
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.data.question.text).toBe('Updated question title');
    expect(editRes.body.data.question.points).toBe(200);
  });

  it('deletes a question and re-normalizes order indices', async () => {
    // Create 3 questions
    const q1 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Q1', options: ['1', '2', '3', '4'], correctAnswer: 0 });
    const q2 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Q2', options: ['1', '2', '3', '4'], correctAnswer: 1 });
    const q3 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Q3', options: ['1', '2', '3', '4'], correctAnswer: 2 });

    const q2Id = q2.body.data.question.id;

    // Delete middle question Q2
    const delRes = await request(app)
      .delete(`/api/v1/quizzes/${quizId}/questions/${q2Id}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(delRes.status).toBe(200);

    // Fetch quiz to check questions order
    const quizRes = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    const remaining = quizRes.body.data.quiz.questions;
    expect(remaining).toHaveLength(2);
    expect(remaining[0].id).toBe(q1.body.data.question.id);
    expect(remaining[0].orderIndex).toBe(0);
    expect(remaining[1].id).toBe(q3.body.data.question.id);
    expect(remaining[1].orderIndex).toBe(1);
  });

  it('safely reorders questions without duplicate or constraint conflicts', async () => {
    const q1 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Q1', options: ['1', '2', '3', '4'], correctAnswer: 0 });
    const q2 = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Q2', options: ['1', '2', '3', '4'], correctAnswer: 1 });

    const id1 = q1.body.data.question.id;
    const id2 = q2.body.data.question.id;

    // Swap Q1 and Q2
    const reorderRes = await request(app)
      .put(`/api/v1/quizzes/${quizId}/questions/reorder`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        orders: [
          { questionId: id1, orderIndex: 1 },
          { questionId: id2, orderIndex: 0 },
        ],
      });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.data.questions[0].id).toBe(id2);
    expect(reorderRes.body.data.questions[0].orderIndex).toBe(0);
    expect(reorderRes.body.data.questions[1].id).toBe(id1);
    expect(reorderRes.body.data.questions[1].orderIndex).toBe(1);
  });

  it('prevents Host B from modifying or deleting Host A questions', async () => {
    const addRes = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ text: 'Host A Q', options: ['1', '2', '3', '4'], correctAnswer: 0 });
    const questionId = addRes.body.data.question.id;

    const editRes = await request(app)
      .patch(`/api/v1/quizzes/${quizId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${hostBToken}`)
      .send({ text: 'Unauthorized edit' });

    expect(editRes.status).toBe(403);

    const delRes = await request(app)
      .delete(`/api/v1/quizzes/${quizId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${hostBToken}`);

    expect(delRes.status).toBe(403);
  });
});
