import { Response, NextFunction } from 'express';
import { quizService } from '../services/quizService.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { ListQuizzesQuery } from '../schemas/quizSchemas.js';

export class QuizController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quiz = await quizService.createQuiz(hostId, req.body);
      sendSuccess(res, { quiz }, 'Quiz created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const query = req.query as unknown as ListQuizzesQuery;
      const result = await quizService.listQuizzes(hostId, query);
      sendSuccess(res, result, 'Quizzes retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const metrics = await quizService.getMetrics(hostId);
      sendSuccess(res, { metrics }, 'Quiz metrics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const quiz = await quizService.getQuizById(quizId, hostId);
      sendSuccess(res, { quiz }, 'Quiz retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const quiz = await quizService.updateQuiz(quizId, hostId, req.body);
      sendSuccess(res, { quiz }, 'Quiz updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const quiz = await quizService.publishQuiz(quizId, hostId);
      sendSuccess(res, { quiz }, 'Quiz published successfully');
    } catch (error) {
      next(error);
    }
  }

  async archive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const quiz = await quizService.archiveQuiz(quizId, hostId);
      sendSuccess(res, { quiz }, 'Quiz archived successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const quiz = await quizService.deleteQuiz(quizId, hostId);
      sendSuccess(res, { quiz }, 'Quiz deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const quizController = new QuizController();
