import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { cleanDatabase } from '../setup.js';

describe('Session Management REST API', () => {
  let hostAToken: string;
  let hostBToken: string;
  let publishedQuizId: string;
  let draftQuizId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Register host A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Alice',
      email: 'alice.host@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostAToken = resA.body.data.token;

    // Register host B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Bob',
      email: 'bob.host@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostBToken = resB.body.data.token;

    // Create published quiz for Host A
    const quizRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'College Quiz Bowl' });
    publishedQuizId = quizRes.body.data.quiz.id;

    // Add question
    await request(app)
      .post(`/api/v1/quizzes/${publishedQuizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'What is the speed of light in vacuum?',
        options: ['3x10^8 m/s', '3x10^6 m/s', '1.5x10^8 m/s', '3x10^5 km/s'],
        correctAnswer: 0,
        points: 100,
        timeLimitSeconds: 20,
      });

    // Publish quiz
    await request(app)
      .post(`/api/v1/quizzes/${publishedQuizId}/publish`)
      .set('Authorization', `Bearer ${hostAToken}`);

    // Create draft quiz (not published)
    const draftRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Unpublished Draft Quiz' });
    draftQuizId = draftRes.body.data.quiz.id;
  });

  it('creates a session from a published quiz with a unique 6-char room code', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ quizId: publishedQuizId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session).toHaveProperty('roomCode');
    expect(res.body.data.session.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.data.session.status).toBe('WAITING');
    expect(res.body.data.session.currentQuestionIndex).toBe(0);
  });

  it('rejects creating a session from an unpublished (DRAFT) quiz', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ quizId: draftQuizId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Only published quizzes');
  });

  it('prevents Host B from creating a session from Host A’s quiz (403)', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostBToken}`)
      .send({ quizId: publishedQuizId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('retrieves safe public room information without exposing answers', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ quizId: publishedQuizId });
    const roomCode = sessionRes.body.data.session.roomCode;

    const res = await request(app).get(`/api/v1/sessions/${roomCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.room.roomCode).toBe(roomCode);
    expect(res.body.data.room.quizTitle).toBe('College Quiz Bowl');
    expect(res.body.data.room.totalQuestions).toBe(1);
    expect(res.body.data.room.status).toBe('WAITING');
    // Ensure no correct answers or private secrets are leaked
    expect(res.body.data.room).not.toHaveProperty('correctAnswer');
    expect(res.body.data.room).not.toHaveProperty('questions');
  });

  it('rejects retrieval of a non-existent room code (404)', async () => {
    const res = await request(app).get('/api/v1/sessions/NONEXIST');
    expect(res.status).toBe(404);
  });
});
