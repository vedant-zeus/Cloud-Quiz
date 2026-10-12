import { Question } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export class QuestionRepository {
  async create(data: {
    quizId: string;
    text: string;
    options: string[];
    correctAnswer: number;
    points: number;
    timeLimitSeconds: number;
    orderIndex: number;
  }): Promise<Question> {
    return prisma.question.create({
      data: {
        quizId: data.quizId,
        text: data.text,
        options: data.options,
        correctAnswer: data.correctAnswer,
        points: data.points,
        timeLimitSeconds: data.timeLimitSeconds,
        orderIndex: data.orderIndex,
      },
    });
  }

  async findById(id: string): Promise<Question | null> {
    return prisma.question.findUnique({
      where: { id },
      include: {
        quiz: true,
      },
    });
  }

  async findByQuizId(quizId: string): Promise<Question[]> {
    return prisma.question.findMany({
      where: { quizId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async countByQuizId(quizId: string): Promise<number> {
    return prisma.question.count({
      where: { quizId },
    });
  }

  async getMaxOrderIndex(quizId: string): Promise<number> {
    const question = await prisma.question.findFirst({
      where: { quizId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return question ? question.orderIndex : -1;
  }

  async update(
    id: string,
    data: Partial<{
      text: string;
      options: string[];
      correctAnswer: number;
      points: number;
      timeLimitSeconds: number;
      orderIndex: number;
    }>
  ): Promise<Question> {
    return prisma.question.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Question> {
    return prisma.question.delete({
      where: { id },
    });
  }

  async normalizeOrdersAfterDelete(quizId: string): Promise<void> {
    const questions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { orderIndex: 'asc' },
    });

    await prisma.$transaction(async (tx) => {
      // Step 1: Temporarily shift order indices to avoid collision
      for (let i = 0; i < questions.length; i++) {
        await tx.question.update({
          where: { id: questions[i].id },
          data: { orderIndex: -(i + 1) },
        });
      }
      // Step 2: Set consecutive 0-based indices
      for (let i = 0; i < questions.length; i++) {
        await tx.question.update({
          where: { id: questions[i].id },
          data: { orderIndex: i },
        });
      }
    });
  }

  async reorder(
    quizId: string,
    orders: Array<{ questionId: string; orderIndex: number }>
  ): Promise<Question[]> {
    await prisma.$transaction(async (tx) => {
      // Step 1: Shift to negative temporary indices to prevent unique constraint collisions on (quizId, orderIndex)
      for (let i = 0; i < orders.length; i++) {
        await tx.question.update({
          where: { id: orders[i].questionId },
          data: { orderIndex: -(i + 1) },
        });
      }

      // Step 2: Assign target orderIndex
      for (const item of orders) {
        await tx.question.update({
          where: { id: item.questionId },
          data: { orderIndex: item.orderIndex },
        });
      }
    });

    return prisma.question.findMany({
      where: { quizId },
      orderBy: { orderIndex: 'asc' },
    });
  }
}

export const questionRepository = new QuestionRepository();
