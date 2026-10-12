import { Quiz, QuizStatus } from '@prisma/client';
import { quizRepository } from '../repositories/quizRepository.js';
import { questionRepository } from '../repositories/questionRepository.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import {
  CreateQuizInput,
  UpdateQuizInput,
  ListQuizzesQuery,
} from '../schemas/quizSchemas.js';
import { PaginatedResult } from '../types/index.js';

export class QuizService {
  async createQuiz(hostId: string, input: CreateQuizInput): Promise<Quiz> {
    return quizRepository.create({
      hostId,
      title: input.title,
      description: input.description,
    });
  }

  async getQuizById(quizId: string, hostId: string): Promise<Quiz> {
    const quiz = await quizRepository.findById(quizId);
    if (!quiz) {
      throw new NotFoundError('Quiz not found');
    }

    if (quiz.hostId !== hostId) {
      throw new ForbiddenError('You do not have permission to access this quiz');
    }

    return quiz;
  }

  async listQuizzes(
    hostId: string,
    query: ListQuizzesQuery
  ): Promise<PaginatedResult<Quiz & { _count: { questions: number } }>> {
    const { page, limit, search, status } = query;
    const { quizzes, total } = await quizRepository.findByHostId(hostId, {
      page,
      limit,
      search,
      status,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getMetrics(hostId: string) {
    return quizRepository.getMetrics(hostId);
  }

  async updateQuiz(quizId: string, hostId: string, input: UpdateQuizInput): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Archived quizzes cannot be edited');
    }

    return quizRepository.update(quizId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
  }

  async publishQuiz(quizId: string, hostId: string): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Archived quizzes cannot be published directly');
    }

    if (quiz.status === QuizStatus.PUBLISHED) {
      return quiz; // Idempotent or already published
    }

    const questionCount = await questionRepository.countByQuizId(quizId);
    if (questionCount === 0) {
      throw new BadRequestError('A quiz must contain at least one question before it can be published');
    }

    return quizRepository.update(quizId, {
      status: QuizStatus.PUBLISHED,
    });
  }

  async archiveQuiz(quizId: string, hostId: string): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      return quiz; // Already archived
    }

    return quizRepository.update(quizId, {
      status: QuizStatus.ARCHIVED,
    });
  }

  async deleteQuiz(quizId: string, hostId: string): Promise<Quiz> {
    const quiz = await this.getQuizById(quizId, hostId);

    if (quiz.status !== QuizStatus.DRAFT) {
      throw new BadRequestError(
        `Only draft quizzes can be deleted. A quiz in ${quiz.status} status cannot be deleted.`
      );
    }

    return quizRepository.delete(quizId);
  }
}

export const quizService = new QuizService();
