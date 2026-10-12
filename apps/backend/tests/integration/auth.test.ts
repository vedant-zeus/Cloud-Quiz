import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { cleanDatabase } from '../setup.js';

describe('Authentication API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  const validHost = {
    name: 'Alice Organizer',
    email: 'alice@college.edu',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  it('registers a new host successfully with HTTP-only cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validHost);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validHost.email);
    expect(res.body.data.user.name).toBe(validHost.name);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data).toHaveProperty('token');

    // Check Set-Cookie header contains token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('token='))).toBe(true);
  });

  it('rejects registration with duplicate email (409)', async () => {
    await request(app).post('/api/v1/auth/register').send(validHost);

    const res = await request(app).post('/api/v1/auth/register').send(validHost);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects registration with invalid email format (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validHost, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration with short/weak password (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validHost, password: 'short', confirmPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration with non-matching passwords (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validHost, confirmPassword: 'DifferentPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in an existing host successfully and issues token', async () => {
    await request(app).post('/api/v1/auth/register').send(validHost);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: validHost.email,
      password: validHost.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validHost.email);
    expect(res.body.data).toHaveProperty('token');
  });

  it('rejects login with invalid password (401)', async () => {
    await request(app).post('/api/v1/auth/register').send(validHost);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: validHost.email,
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects login with non-existent email (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent@college.edu',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated request to /auth/me (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns current user with valid Bearer token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(validHost);
    const token = regRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validHost.email);
  });

  it('logs out and clears cookies', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });
});
