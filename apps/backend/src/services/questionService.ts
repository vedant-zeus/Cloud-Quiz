import { Question, QuizStatus } from '@prisma/client';
import { questionRepository } from '../repositories/questionRepository.js';
import { quizService } from './quizService.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import {
  CreateQuestionInput,
  UpdateQuestionInput,
  ReorderQuestionsInput,
} from '../schemas/questionSchemas.js';

export class QuestionService {
  async addQuestion(
    quizId: string,
    hostId: string,
    input: CreateQuestionInput
  ): Promise<Question> {
    const quiz = await quizService.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Cannot add questions to an archived quiz');
    }

    const maxOrder = await questionRepository.getMaxOrderIndex(quizId);
    const nextOrder = maxOrder + 1;

    return questionRepository.create({
      quizId,
      text: input.text,
      options: input.options,
      correctAnswer: input.correctAnswer,
      points: input.points,
      timeLimitSeconds: input.timeLimitSeconds,
      orderIndex: nextOrder,
    });
  }

  async getQuestionsByQuizId(quizId: string, hostId: string): Promise<Question[]> {
    await quizService.getQuizById(quizId, hostId);
    return questionRepository.findByQuizId(quizId);
  }

  async updateQuestion(
    quizId: string,
    questionId: string,
    hostId: string,
    input: UpdateQuestionInput
  ): Promise<Question> {
    const quiz = await quizService.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Cannot edit questions in an archived quiz');
    }

    const question = await questionRepository.findById(questionId);
    if (!question || question.quizId !== quizId) {
      throw new NotFoundError('Question not found in this quiz');
    }

    return questionRepository.update(questionId, {
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
      ...(input.correctAnswer !== undefined ? { correctAnswer: input.correctAnswer } : {}),
      ...(input.points !== undefined ? { points: input.points } : {}),
      ...(input.timeLimitSeconds !== undefined ? { timeLimitSeconds: input.timeLimitSeconds } : {}),
    });
  }

  async deleteQuestion(
    quizId: string,
    questionId: string,
    hostId: string
  ): Promise<Question> {
    const quiz = await quizService.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Cannot delete questions from an archived quiz');
    }

    const question = await questionRepository.findById(questionId);
    if (!question || question.quizId !== quizId) {
      throw new NotFoundError('Question not found in this quiz');
    }

    const deleted = await questionRepository.delete(questionId);
    await questionRepository.normalizeOrdersAfterDelete(quizId);
    return deleted;
  }

  async reorderQuestions(
    quizId: string,
    hostId: string,
    input: ReorderQuestionsInput
  ): Promise<Question[]> {
    const quiz = await quizService.getQuizById(quizId, hostId);

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestError('Cannot reorder questions in an archived quiz');
    }

    const existingQuestions = await questionRepository.findByQuizId(quizId);
    if (existingQuestions.length !== input.orders.length) {
      throw new BadRequestError(
        `Reorder payload must include all ${existingQuestions.length} questions of the quiz`
      );
    }

    const existingIds = new Set(existingQuestions.map((q) => q.id));
    const payloadIds = new Set(input.orders.map((o) => o.questionId));
    const payloadOrders = new Set(input.orders.map((o) => o.orderIndex));

    for (const item of input.orders) {
      if (!existingIds.has(item.questionId)) {
        throw new BadRequestError(`Question ${item.questionId} does not belong to this quiz`);
      }
    }

    if (payloadIds.size !== existingQuestions.length) {
      throw new BadRequestError('Reorder payload contains duplicate question IDs');
    }

    if (payloadOrders.size !== existingQuestions.length) {
      throw new BadRequestError('Reorder payload contains duplicate order indices');
    }

    for (let i = 0; i < existingQuestions.length; i++) {
      if (!payloadOrders.has(i)) {
        throw new BadRequestError(`Reorder indices must be consecutive from 0 to ${existingQuestions.length - 1}`);
      }
    }

    return questionRepository.reorder(quizId, input.orders);
  }
}

export const questionService = new QuestionService();
