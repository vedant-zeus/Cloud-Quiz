import { Quiz, QuizStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface QuizWithQuestionCount extends Quiz {
  _count: {
    questions: number;
  };
}

export class QuizRepository {
  async create(data: {
    hostId: string;
    title: string;
    description?: string | null;
  }): Promise<Quiz> {
    return prisma.quiz.create({
      data: {
        hostId: data.hostId,
        title: data.title,
        description: data.description ?? null,
        status: QuizStatus.DRAFT,
      },
    });
  }

  async findById(id: string): Promise<(Quiz & { questions: import('@prisma/client').Question[]; _count: { questions: number } }) | null> {
    return prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
        _count: {
          select: { questions: true },
        },
      },
    });
  }

  async findByHostId(
    hostId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      status?: QuizStatus;
    }
  ): Promise<{ quizzes: QuizWithQuestionCount[]; total: number }> {
    const { page, limit, search, status } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.QuizWhereInput = {
      hostId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [quizzes, total] = await Promise.all([
      prisma.quiz.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { questions: true },
          },
        },
      }),
      prisma.quiz.count({ where }),
    ]);

    return { quizzes, total };
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      status?: QuizStatus;
    }
  ): Promise<Quiz> {
    return prisma.quiz.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });
  }

  async delete(id: string): Promise<Quiz> {
    return prisma.quiz.delete({
      where: { id },
    });
  }

  async getMetrics(hostId: string): Promise<{
    total: number;
    draft: number;
    published: number;
    archived: number;
  }> {
    const [total, draft, published, archived] = await Promise.all([
      prisma.quiz.count({ where: { hostId } }),
      prisma.quiz.count({ where: { hostId, status: QuizStatus.DRAFT } }),
      prisma.quiz.count({ where: { hostId, status: QuizStatus.PUBLISHED } }),
      prisma.quiz.count({ where: { hostId, status: QuizStatus.ARCHIVED } }),
    ]);

    return { total, draft, published, archived };
  }
}

export const quizRepository = new QuizRepository();
