import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { cleanDatabase } from '../setup.js';

describe('Quiz Management API', () => {
  let hostAToken: string;
  let hostBToken: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Register host A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Alpha',
      email: 'alpha@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostAToken = resA.body.data.token;

    // Register host B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Host Beta',
      email: 'beta@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostBToken = resB.body.data.token;
  });

  it('creates a new quiz with draft status', async () => {
    const res = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        title: 'National Cloud Computing Bowl',
        description: 'Inter-college technical quiz on AWS and Cloud architecture',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quiz.title).toBe('National Cloud Computing Bowl');
    expect(res.body.data.quiz.status).toBe('DRAFT');
  });

  it('lists only the current host’s quizzes with pagination', async () => {
    // Create 2 quizzes for Host A
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Quiz A1' });
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Quiz A2' });

    // Create 1 quiz for Host B
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostBToken}`)
      .send({ title: 'Quiz B1' });

    // Host A fetches quizzes
    const resA = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.items).toHaveLength(2);
    expect(resA.body.data.pagination.total).toBe(2);

    // Host B fetches quizzes
    const resB = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.items).toHaveLength(1);
    expect(resB.body.data.items[0].title).toBe('Quiz B1');
  });

  it('retrieves a single quiz by ID', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Kubernetes Challenge' });

    const quizId = createRes.body.data.quiz.id;

    const res = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quiz.id).toBe(quizId);
    expect(res.body.data.quiz.title).toBe('Kubernetes Challenge');
  });

  it('prevents cross-user access (Host B cannot view Host A quiz)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Host A Private Quiz' });

    const quizId = createRes.body.data.quiz.id;

    const res = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('updates quiz title and description', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Draft Title' });

    const quizId = createRes.body.data.quiz.id;

    const res = await request(app)
      .patch(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        title: 'Updated Final Title',
        description: 'New detailed description',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.quiz.title).toBe('Updated Final Title');
    expect(res.body.data.quiz.description).toBe('New detailed description');
  });

  it('prevents Host B from modifying Host A quiz', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Host A Quiz' });

    const quizId = createRes.body.data.quiz.id;

    const res = await request(app)
      .patch(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostBToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });

  it('prevents publishing an empty quiz without questions', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Empty Quiz' });

    const quizId = createRes.body.data.quiz.id;

    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('at least one question');
  });

  it('publishes a quiz after adding a question', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Valid Quiz' });

    const quizId = createRes.body.data.quiz.id;

    // Add a question
    await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'What is Amazon S3?',
        options: ['Simple Storage Service', 'Server Storage System', 'Simple Socket Solution', 'Secure Store Service'],
        correctAnswer: 0,
        points: 100,
        timeLimitSeconds: 30,
      });

    // Now publish
    const pubRes = await request(app)
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.quiz.status).toBe('PUBLISHED');
  });

  it('prevents deletion of published quizzes', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Published Quiz to Delete' });

    const quizId = createRes.body.data.quiz.id;

    await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({
        text: 'Sample Q',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
      });

    await request(app)
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${hostAToken}`);

    // Try to delete published quiz
    const delRes = await request(app)
      .delete(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(delRes.status).toBe(400);
    expect(delRes.body.error.message).toContain('Only draft quizzes can be deleted');
  });

  it('deletes draft quizzes successfully', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Draft to Delete' });

    const quizId = createRes.body.data.quiz.id;

    const delRes = await request(app)
      .delete(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(getRes.status).toBe(404);
  });

  it('archives a quiz and prevents editing while archived', async () => {
    const createRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'Quiz to Archive' });

    const quizId = createRes.body.data.quiz.id;

    const archRes = await request(app)
      .post(`/api/v1/quizzes/${quizId}/archive`)
      .set('Authorization', `Bearer ${hostAToken}`);

    expect(archRes.status).toBe(200);
    expect(archRes.body.data.quiz.status).toBe('ARCHIVED');

    // Attempting to edit archived quiz fails
    const editRes = await request(app)
      .patch(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${hostAToken}`)
      .send({ title: 'New Name' });

    expect(editRes.status).toBe(400);
    expect(editRes.body.error.message).toContain('Archived quizzes cannot be edited');
  });
});
