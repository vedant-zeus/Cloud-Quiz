import { Response, NextFunction } from 'express';
import { questionService } from '../services/questionService.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export class QuestionController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const question = await questionService.addQuestion(quizId, hostId, req.body);
      sendSuccess(res, { question }, 'Question added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const { id: quizId, questionId } = req.params;
      const question = await questionService.updateQuestion(quizId, questionId, hostId, req.body);
      sendSuccess(res, { question }, 'Question updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const { id: quizId, questionId } = req.params;
      const question = await questionService.deleteQuestion(quizId, questionId, hostId);
      sendSuccess(res, { question }, 'Question deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.id;
      const quizId = req.params.id;
      const questions = await questionService.reorderQuestions(quizId, hostId, req.body);
      sendSuccess(res, { questions }, 'Questions reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const questionController = new QuestionController();
