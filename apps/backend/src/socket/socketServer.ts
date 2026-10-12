import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env.js';
import { sessionService } from '../services/sessionService.js';
import { timerManager } from './timerManager.js';
import { socketMetrics } from './metrics.js';
import {
  roomJoinSchema,
  roomSyncSchema,
  quizStartSchema,
  questionNextSchema,
  questionCloseSchema,
  answerSubmitSchema,
  quizEndSchema,
} from './socketSchemas.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

type AckCallback = (response: {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}) => void;

function formatError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as { code: string; message: string };
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { code: 'INTERNAL_ERROR', message };
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts[1].trim());
    }
  });
  return list;
}

function extractHostUser(socket: Socket): { id: string; email: string; name: string } | null {
  try {
    const authHeader = socket.handshake.auth?.token || socket.handshake.auth?.hostToken;
    let token = authHeader;

    if (!token && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies.token;
    }

    if (token) {
      return verifyToken(token);
    }
  } catch {
    // Token invalid
  }
  return null;
}

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Wire automatic countdown timer expiration callback
  timerManager.setExpirationHandler(async (roomCode: string) => {
    try {
      console.log(`[Timer] Auto-closing question for room ${roomCode}`);
      const closedData = await sessionService.closeQuestion(roomCode);
      if (closedData) {
        io.to(roomCode).emit('question:ended', {
          questionId: closedData.questionId,
          correctAnswer: closedData.correctAnswer,
          stats: closedData.stats,
          detailedAnalytics: closedData.detailedAnalytics,
          questionNumber: closedData.questionNumber,
          totalQuestions: closedData.totalQuestions,
        });

        io.to(roomCode).emit('leaderboard:update', {
          leaderboard: closedData.leaderboard,
        });
      }
    } catch (err) {
      console.error(`[Timer] Failed to close question for room ${roomCode}:`, err);
    }
  });

  io.on('connection', (socket: Socket) => {
    socketMetrics.increment('connectedSockets');

    // 1. Participant Joins Room
    socket.on('room:join', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = roomJoinSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid join payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const { roomCode, displayName } = parsed.data;
        const normalizedCode = roomCode.toUpperCase();

        const { participant, token, roomState } = await sessionService.joinRoom(normalizedCode, displayName);

        // Store participant session in socket
        socket.data.participantId = participant.id;
        socket.data.participantToken = token;
        socket.data.roomCode = normalizedCode;

        socket.join(normalizedCode);
        socketMetrics.increment('connectedParticipants');

        console.log(`[Room] Participant ${displayName} joined room ${normalizedCode}`);

        // Broadcast updated count & state
        socket.to(normalizedCode).emit('room:participant-count', {
          count: roomState.participantCount,
        });
        socket.to(normalizedCode).emit('room:state', roomState);

        const responseData = {
          participantId: participant.id,
          token,
          roomState,
        };

        socket.emit('room:joined', responseData);
        ack?.({ success: true, data: responseData });
      } catch (error) {
        socketMetrics.increment('invalidStateTransitions');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 2. Room State Sync (Reconnection & Polling)
    socket.on('room:sync', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = roomSyncSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid sync payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const normalizedCode = parsed.data.roomCode.toUpperCase();
        const session = await sessionService.getSessionByRoomCode(normalizedCode);

        // Check host or participant identity
        const hostUser = extractHostUser(socket);
        const isHost = Boolean(hostUser && hostUser.id === session.quiz.hostId);

        let participant = null;
        const pToken = (payload as { token?: string })?.token || socket.handshake.auth?.participantToken || socket.data.participantToken;
        if (pToken) {
          try {
            participant = await sessionService.authenticateParticipant(normalizedCode, pToken);
            socket.data.participantId = participant.id;
            socket.data.participantToken = pToken;
          } catch {
            // Unauthenticated participant, continue with public snapshot
          }
        }

        socket.join(normalizedCode);
        socket.data.roomCode = normalizedCode;

        const snapshot = await sessionService.getRoomSnapshot(session, participant, isHost);

        socket.emit('room:state', snapshot);
        ack?.({ success: true, data: { roomState: snapshot } });
      } catch (error) {
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 3. Host Starts Quiz
    socket.on('quiz:start', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = quizStartSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid start payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const hostUser = extractHostUser(socket);
        if (!hostUser) {
          const err = { code: 'UNAUTHORIZED', message: 'Host authentication required to start quiz' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const normalizedCode = parsed.data.roomCode.toUpperCase();
        socket.join(normalizedCode);

        const { question, deadline } = await sessionService.startQuiz(normalizedCode, hostUser.id);
        socketMetrics.increment('activeSessions');

        console.log(`[Quiz] Host started quiz for room ${normalizedCode}`);

        io.to(normalizedCode).emit('quiz:started', { roomCode: normalizedCode });
        io.to(normalizedCode).emit('question:started', question);

        ack?.({ success: true, data: { question, deadline } });
      } catch (error) {
        socketMetrics.increment('invalidStateTransitions');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 4. Participant Submits Answer
    socket.on('answer:submit', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = answerSubmitSchema.safeParse(payload);
        if (!parsed.success) {
          socketMetrics.increment('rejectedAnswers');
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid answer payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const { roomCode, questionId, selectedOption, submissionId } = parsed.data;
        const normalizedCode = roomCode.toUpperCase();

        // Authenticate participant
        const token = (payload as { token?: string })?.token || socket.handshake.auth?.participantToken || socket.data.participantToken;
        if (!token) {
          socketMetrics.increment('rejectedAnswers');
          const err = { code: 'UNAUTHORIZED', message: 'Participant authentication credential required to submit answer' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const participant = await sessionService.authenticateParticipant(normalizedCode, token);

        const result = await sessionService.submitAnswer({
          roomCode: normalizedCode,
          participantId: participant.id,
          questionId,
          selectedOption,
          submissionId,
        });

        socketMetrics.increment('acceptedAnswers');

        socket.emit('answer:ack', {
          success: true,
          message: 'Answer submitted and accepted',
          isCorrect: result.isCorrect,
          pointsAwarded: result.pointsAwarded,
        });

        ack?.({
          success: true,
          data: {
            isCorrect: result.isCorrect,
            pointsAwarded: result.pointsAwarded,
          },
        });
      } catch (error) {
        socketMetrics.increment('rejectedAnswers');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 5. Host Closes Question
    socket.on('question:close', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = questionCloseSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const hostUser = extractHostUser(socket);
        if (!hostUser) {
          const err = { code: 'UNAUTHORIZED', message: 'Host authentication required to close question' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const normalizedCode = parsed.data.roomCode.toUpperCase();
        const closedData = await sessionService.closeQuestion(normalizedCode, hostUser.id);

        if (closedData) {
          console.log(`[Quiz] Host closed question for room ${normalizedCode}`);

          io.to(normalizedCode).emit('question:ended', {
            questionId: closedData.questionId,
            correctAnswer: closedData.correctAnswer,
            stats: closedData.stats,
            detailedAnalytics: closedData.detailedAnalytics,
            questionNumber: closedData.questionNumber,
            totalQuestions: closedData.totalQuestions,
          });

          io.to(normalizedCode).emit('leaderboard:update', {
            leaderboard: closedData.leaderboard,
          });

          ack?.({ success: true, data: closedData });
        } else {
          // Idempotent close
          ack?.({ success: true, data: null });
        }
      } catch (error) {
        socketMetrics.increment('invalidStateTransitions');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 6. Host Advances to Next Question
    socket.on('question:next', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = questionNextSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const hostUser = extractHostUser(socket);
        if (!hostUser) {
          const err = { code: 'UNAUTHORIZED', message: 'Host authentication required to advance question' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const normalizedCode = parsed.data.roomCode.toUpperCase();
        const result = await sessionService.nextQuestion(normalizedCode, hostUser.id);

        if (result.isComplete) {
          console.log(`[Quiz] Quiz completed for room ${normalizedCode}`);
          socketMetrics.decrement('activeSessions');
          io.to(normalizedCode).emit('quiz:ended', {
            roomCode: normalizedCode,
            leaderboard: result.leaderboard,
          });
          ack?.({ success: true, data: { isComplete: true, leaderboard: result.leaderboard } });
        } else {
          console.log(`[Quiz] Advanced to next question in room ${normalizedCode}`);
          io.to(normalizedCode).emit('question:started', result.question);
          ack?.({ success: true, data: { isComplete: false, question: result.question } });
        }
      } catch (error) {
        socketMetrics.increment('invalidStateTransitions');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 7. Host Explicitly Ends Quiz
    socket.on('quiz:end', async (payload: unknown, ack?: AckCallback) => {
      try {
        const parsed = quizEndSchema.safeParse(payload);
        if (!parsed.success) {
          const err = { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid payload' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const hostUser = extractHostUser(socket);
        if (!hostUser) {
          const err = { code: 'UNAUTHORIZED', message: 'Host authentication required to end quiz' };
          ack?.({ success: false, error: err });
          socket.emit('server:error', err);
          return;
        }

        const normalizedCode = parsed.data.roomCode.toUpperCase();
        const { leaderboard } = await sessionService.endQuiz(normalizedCode, hostUser.id);
        socketMetrics.decrement('activeSessions');

        console.log(`[Quiz] Host explicitly ended quiz for room ${normalizedCode}`);
        io.to(normalizedCode).emit('quiz:ended', {
          roomCode: normalizedCode,
          leaderboard,
        });

        ack?.({ success: true, data: { leaderboard } });
      } catch (error) {
        socketMetrics.increment('invalidStateTransitions');
        const err = formatError(error);
        ack?.({ success: false, error: err });
        socket.emit('server:error', err);
      }
    });

    // 8. Disconnect
    socket.on('disconnect', () => {
      socketMetrics.decrement('connectedSockets');
      if (socket.data.participantId) {
        socketMetrics.decrement('connectedParticipants');
      }
    });
  });

  return io;
}
