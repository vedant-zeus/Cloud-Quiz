import { Response, NextFunction } from 'express';
import { sessionService } from '../services/sessionService.js';
import { analyticsService } from '../services/analyticsService.js';
import { leaderboardService } from '../services/leaderboardService.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { hashParticipantToken } from '../utils/token.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyToken } from '../utils/jwt.js';
import { ForbiddenError, UnauthorizedError, NotFoundError } from '../utils/errors.js';

export class SessionController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const { quizId } = req.body;
      const result = await sessionService.createSession(hostId, quizId);
      sendSuccess(res, result, 'Competition session created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getRoomInfo(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const roomInfo = await sessionService.getPublicRoomInfo(roomCode);
      sendSuccess(res, { room: roomInfo }, 'Room information retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getResults(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      let hostId: string | undefined = req.user?.id;

      if (!hostId) {
        const token =
          req.cookies?.token ||
          (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.substring(7)
            : null);
        if (token) {
          try {
            const decoded = verifyToken(token);
            hostId = decoded.id;
          } catch {
            // Token invalid or expired, continue without host identity
          }
        }
      }

      const results = await sessionService.getResults(roomCode, hostId);
      sendSuccess(res, results, 'Session results retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const hostId = req.user!.id;
      const session = await sessionService.getSessionByRoomCode(roomCode);

      if (session.quiz.hostId !== hostId) {
        throw new ForbiddenError('Only the quiz host can view competition analytics');
      }

      const analytics = await analyticsService.getCompetitionAnalytics(session.id);
      sendSuccess(res, { analytics }, 'Competition analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getParticipantResults(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const session = await sessionService.getSessionByRoomCode(roomCode);

      // Support participant token from header or query param
      const participantToken =
        (req.headers['x-participant-token'] as string) || (req.query.token as string);

      let participantId: string | null = null;

      if (participantToken) {
        const tokenHash = hashParticipantToken(participantToken);
        const participant = await sessionRepository.findParticipantByTokenHash(
          session.id,
          tokenHash
        );
        if (participant) {
          participantId = participant.id;
        }
      }

      // Allow host to view specific participant results
      if (!participantId && req.user && session.quiz.hostId === req.user.id && req.query.participantId) {
        participantId = req.query.participantId as string;
      }

      if (!participantId) {
        throw new UnauthorizedError('Valid participant credentials required to view personal results');
      }

      const results = await analyticsService.getParticipantResults(session.id, participantId);
      sendSuccess(res, results, 'Participant results retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async exportLeaderboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const hostId = req.user!.id;
      const session = await sessionService.getSessionByRoomCode(roomCode);

      if (session.quiz.hostId !== hostId) {
        throw new ForbiddenError('Only the quiz host can export competition data');
      }

      const csvData = await analyticsService.exportLeaderboardCsv(session.id);
      const filename = `leaderboard-${session.roomCode}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  async exportAnswers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomCode } = req.params;
      const hostId = req.user!.id;
      const session = await sessionService.getSessionByRoomCode(roomCode);

      if (session.quiz.hostId !== hostId) {
        throw new ForbiddenError('Only the quiz host can export competition data');
      }

      const csvData = await analyticsService.exportAnswersCsv(session.id);
      const filename = `answers-${session.roomCode}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;

      const history = await analyticsService.getHistoricalCompetitions(hostId, {
        page,
        limit,
        search,
        status,
      });

      sendSuccess(res, history, 'Competition history retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getHistoryDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const { sessionId } = req.params;

      const session = await sessionRepository.findById(sessionId);
      if (!session) {
        throw new NotFoundError('Historical competition not found');
      }

      if (session.quiz.hostId !== hostId) {
        throw new ForbiddenError('You do not have access to this competition');
      }

      const [analytics, leaderboard] = await Promise.all([
        analyticsService.getCompetitionAnalytics(sessionId),
        leaderboardService.getLeaderboard(sessionId),
      ]);

      sendSuccess(
        res,
        {
          session: {
            id: session.id,
            roomCode: session.roomCode,
            status: session.status,
            quizTitle: session.quiz.title,
            quizId: session.quiz.id,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            createdAt: session.createdAt,
            participantCount: session.participants.length,
          },
          analytics,
          leaderboard,
        },
        'Historical competition detail retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const sessionController = new SessionController();
