import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { app } from '../../src/app.js';
import { initSocketServer } from '../../src/socket/socketServer.js';
import { timerManager } from '../../src/socket/timerManager.js';
import { cleanDatabase } from '../setup.js';
import { AddressInfo } from 'net';

describe('Real-Time Socket.IO Multiplayer Quiz Gameplay', () => {
  let server: http.Server;
  let serverPort: number;
  let hostToken: string;
  let quizId: string;
  let roomCode: string;
  const activeSockets: ClientSocket[] = [];

  function createClient(options?: Record<string, unknown>): ClientSocket {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: true,
      forceNew: true,
      ...options,
    });
    activeSockets.push(socket);
    return socket;
  }

  function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event "${event}" after ${timeout}ms`));
      }, timeout);

      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  beforeAll(async () => {
    server = http.createServer(app);
    initSocketServer(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    timerManager.clearAllTimers();
    for (const socket of activeSockets) {
      if (socket.connected) socket.disconnect();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    timerManager.clearAllTimers();
    for (const socket of activeSockets) {
      if (socket.connected) socket.disconnect();
    }
    activeSockets.length = 0;
    await cleanDatabase();

    // 1. Register host
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Competition Host',
      email: 'host@college.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    hostToken = regRes.body.data.token;

    // 2. Create quiz with 2 questions
    const qRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Inter-College Cloud Championship' });
    quizId = qRes.body.data.quiz.id;

    // Question 1
    await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        text: 'Which AWS service provides serverless compute?',
        options: ['Amazon EC2', 'AWS Lambda', 'Amazon RDS', 'Amazon S3'],
        correctAnswer: 1, // Option B
        points: 100,
        timeLimitSeconds: 20,
      });

    // Question 2
    await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        text: 'What is DynamoDB?',
        options: ['Relational Database', 'NoSQL Key-Value Store', 'Message Queue', 'DNS Service'],
        correctAnswer: 1, // Option B
        points: 200,
        timeLimitSeconds: 15,
      });

    // Publish quiz
    await request(app)
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${hostToken}`);

    // Create session
    const sRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ quizId });
    roomCode = sRes.body.data.session.roomCode;
  });

  it('allows students to join a room with a display name and receives credentials', async () => {
    const studentSocket = createClient();
    await waitForEvent(studentSocket, 'connect');

    const joinPromise = waitForEvent<{ participantId: string; token: string; roomState: { roomCode: string } }>(
      studentSocket,
      'room:joined'
    );

    studentSocket.emit('room:join', {
      roomCode,
      displayName: 'Alice Johnson',
    });

    const joinData = await joinPromise;
    expect(joinData).toBeDefined();
    expect(joinData).toHaveProperty('token');
    expect(joinData).toHaveProperty('participantId');
    expect(joinData.roomState.roomCode).toBe(roomCode);
  });

  it('rejects duplicate display names in the same room', async () => {
    const student1 = createClient();
    await waitForEvent(student1, 'connect');

    student1.emit('room:join', { roomCode, displayName: 'Charlie' });
    await waitForEvent(student1, 'room:joined');

    const student2 = createClient();
    await waitForEvent(student2, 'connect');

    const errorPromise = waitForEvent<{ code: string; message: string }>(student2, 'server:error');
    student2.emit('room:join', { roomCode, displayName: 'Charlie' });

    const err = await errorPromise;
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toContain('already taken');
  });

  it('rejects invalid room codes on join', async () => {
    const student = createClient();
    await waitForEvent(student, 'connect');

    const errorPromise = waitForEvent<{ code: string; message: string }>(student, 'server:error');
    student.emit('room:join', { roomCode: 'ZZZZZZ', displayName: 'David' });

    const err = await errorPromise;
    expect(err.code).toBe('NOT_FOUND');
  });

  it('broadcasts participant count update when new students join', async () => {
    const hostSocket = createClient({ auth: { token: hostToken } });
    await waitForEvent(hostSocket, 'connect');
    hostSocket.emit('room:sync', { roomCode });
    await waitForEvent(hostSocket, 'room:state');

    const countPromise = waitForEvent<{ count: number }>(hostSocket, 'room:participant-count');

    const studentSocket = createClient();
    await waitForEvent(studentSocket, 'connect');
    studentSocket.emit('room:join', { roomCode, displayName: 'Emma Stone' });

    const countData = await countPromise;
    expect(countData.count).toBe(1);
  });

  it('executes full gameplay: start quiz, receive question without answer, submit, score, close, reveal answer, advance, and end', async () => {
    // 1. Setup Host
    const hostSocket = createClient({ auth: { token: hostToken } });
    await waitForEvent(hostSocket, 'connect');

    // 2. Setup 2 Students: Alice and Bob
    const aliceSocket = createClient();
    await waitForEvent(aliceSocket, 'connect');
    aliceSocket.emit('room:join', { roomCode, displayName: 'Alice' });
    const aliceJoin = await waitForEvent<{ token: string; participantId: string }>(aliceSocket, 'room:joined');

    const bobSocket = createClient();
    await waitForEvent(bobSocket, 'connect');
    bobSocket.emit('room:join', { roomCode, displayName: 'Bob' });
    const bobJoin = await waitForEvent<{ token: string; participantId: string }>(bobSocket, 'room:joined');

    // 3. Host starts quiz
    const aliceQuestionPromise = waitForEvent<{
      id: string;
      text: string;
      options: string[];
      questionNumber: number;
      points: number;
      questionDeadline: string;
    }>(aliceSocket, 'question:started');

    hostSocket.emit('quiz:start', { roomCode });

    const q1Data = await aliceQuestionPromise;
    expect(q1Data.text).toBe('Which AWS service provides serverless compute?');
    expect(q1Data.options).toHaveLength(4);
    expect(q1Data.questionNumber).toBe(1);
    expect(q1Data.points).toBe(100);
    // CRITICAL SECURITY RULE: Never leak correctAnswer before question is closed!
    expect(q1Data).not.toHaveProperty('correctAnswer');

    // 4. Alice submits correct answer (Option 1 = AWS Lambda)
    const aliceAckPromise = waitForEvent<{ isCorrect: boolean; pointsAwarded: number }>(aliceSocket, 'answer:ack');
    aliceSocket.emit('answer:submit', {
      roomCode,
      questionId: q1Data.id,
      selectedOption: 1, // Correct
      submissionId: 'alice-sub-q1',
      token: aliceJoin.token,
    });
    const aliceAck = await aliceAckPromise;
    expect(aliceAck.isCorrect).toBe(true);
    expect(aliceAck.pointsAwarded).toBe(100);

    // 5. Bob submits incorrect answer (Option 0 = Amazon EC2)
    const bobAckPromise = waitForEvent<{ isCorrect: boolean; pointsAwarded: number }>(bobSocket, 'answer:ack');
    bobSocket.emit('answer:submit', {
      roomCode,
      questionId: q1Data.id,
      selectedOption: 0, // Incorrect
      submissionId: 'bob-sub-q1',
      token: bobJoin.token,
    });
    const bobAck = await bobAckPromise;
    expect(bobAck.isCorrect).toBe(false);
    expect(bobAck.pointsAwarded).toBe(0);

    // 6. Alice tries to submit duplicate answer for same question -> rejected!
    const aliceDupPromise = waitForEvent<{ code: string; message: string }>(aliceSocket, 'server:error');
    aliceSocket.emit('answer:submit', {
      roomCode,
      questionId: q1Data.id,
      selectedOption: 2,
      submissionId: 'alice-sub-q1-duplicate',
      token: aliceJoin.token,
    });
    const dupErr = await aliceDupPromise;
    expect(dupErr.code).toBe('BAD_REQUEST');
    expect(dupErr.message).toContain('already submitted');

    // 7. Host closes question 1
    const questionEndedPromise = waitForEvent<{
      questionId: string;
      correctAnswer: number;
      stats: { option0: number; option1: number; totalAnswered: number };
    }>(aliceSocket, 'question:ended');
    const leaderboardPromise = waitForEvent<{
      leaderboard: Array<{ displayName: string; score: number; rank: number }>;
    }>(aliceSocket, 'leaderboard:update');

    hostSocket.emit('question:close', { roomCode });

    const qEndedData = await questionEndedPromise;
    // Correct answer is revealed after question closes
    expect(qEndedData.correctAnswer).toBe(1);
    expect(qEndedData.stats.totalAnswered).toBe(2);
    expect(qEndedData.stats.option1).toBe(1); // Alice
    expect(qEndedData.stats.option0).toBe(1); // Bob

    const lbData = await leaderboardPromise;
    expect(lbData.leaderboard[0].displayName).toBe('Alice');
    expect(lbData.leaderboard[0].score).toBe(100);
    expect(lbData.leaderboard[1].displayName).toBe('Bob');
    expect(lbData.leaderboard[1].score).toBe(0);

    // 8. Host advances to next question (Question 2)
    const q2Promise = waitForEvent<{ id: string; text: string; points: number }>(aliceSocket, 'question:started');
    hostSocket.emit('question:next', { roomCode });
    const q2Data = await q2Promise;
    expect(q2Data.text).toBe('What is DynamoDB?');
    expect(q2Data.points).toBe(200);

    // Bob answers correctly this time (Option 1 = NoSQL Key-Value Store)
    const bobQ2AckPromise = waitForEvent<{ isCorrect: boolean; pointsAwarded: number }>(bobSocket, 'answer:ack');
    bobSocket.emit('answer:submit', {
      roomCode,
      questionId: q2Data.id,
      selectedOption: 1, // Correct
      submissionId: 'bob-sub-q2',
      token: bobJoin.token,
    });
    const bobQ2Ack = await bobQ2AckPromise;
    expect(bobQ2Ack.isCorrect).toBe(true);
    expect(bobQ2Ack.pointsAwarded).toBe(200);

    // Host closes question 2
    hostSocket.emit('question:close', { roomCode });
    await waitForEvent(aliceSocket, 'question:ended');

    // 9. Host advances after question 2 -> Quiz Ends!
    const quizEndedPromise = waitForEvent<{
      roomCode: string;
      leaderboard: Array<{ displayName: string; score: number; rank: number }>;
    }>(aliceSocket, 'quiz:ended');

    hostSocket.emit('question:next', { roomCode });
    const finalData = await quizEndedPromise;
    expect(finalData.roomCode).toBe(roomCode);
    expect(finalData.leaderboard).toHaveLength(2);
    // Bob has 200 pts, Alice has 100 pts -> Bob is Rank 1, Alice is Rank 2
    expect(finalData.leaderboard[0].displayName).toBe('Bob');
    expect(finalData.leaderboard[0].score).toBe(200);
    expect(finalData.leaderboard[0].rank).toBe(1);
    expect(finalData.leaderboard[1].displayName).toBe('Alice');
    expect(finalData.leaderboard[1].score).toBe(100);
    expect(finalData.leaderboard[1].rank).toBe(2);
  });

  it('restores accurate session state on reconnection with room:sync', async () => {
    // Start quiz
    const hostSocket = createClient({ auth: { token: hostToken } });
    await waitForEvent(hostSocket, 'connect');

    const studentSocket = createClient();
    await waitForEvent(studentSocket, 'connect');
    studentSocket.emit('room:join', { roomCode, displayName: 'SyncTester' });
    const joinData = await waitForEvent<{ token: string; participantId: string }>(studentSocket, 'room:joined');

    hostSocket.emit('quiz:start', { roomCode });
    await waitForEvent(studentSocket, 'question:started');

    // Student disconnects and reconnects with new socket
    studentSocket.disconnect();

    const reconnectedSocket = createClient();
    await waitForEvent(reconnectedSocket, 'connect');

    const syncPromise = waitForEvent<{
      status: string;
      currentQuestion: { text: string };
      hasAnsweredCurrent: boolean;
      myScore: number;
    }>(reconnectedSocket, 'room:state');

    reconnectedSocket.emit('room:sync', {
      roomCode,
      token: joinData.token,
    });

    const syncedState = await syncPromise;
    expect(syncedState.status).toBe('QUESTION_ACTIVE');
    expect(syncedState.currentQuestion.text).toBe('Which AWS service provides serverless compute?');
    expect(syncedState.hasAnsweredCurrent).toBe(false);
    expect(syncedState.myScore).toBe(0);
  });
});
