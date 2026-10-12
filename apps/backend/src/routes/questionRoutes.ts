import { Router } from 'express';
import { questionController } from '../controllers/questionController.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  questionParamsSchema,
  reorderQuestionsSchema,
} from '../schemas/questionSchemas.js';
import { quizIdParamSchema } from '../schemas/quizSchemas.js';

const router = Router({ mergeParams: true });

router.post(
  '/',
  validateRequest({ params: quizIdParamSchema, body: createQuestionSchema }),
  questionController.create
);

router.put(
  '/reorder',
  validateRequest({ params: quizIdParamSchema, body: reorderQuestionsSchema }),
  questionController.reorder
);

router.patch(
  '/:questionId',
  validateRequest({ params: questionParamsSchema, body: updateQuestionSchema }),
  questionController.update
);

router.delete(
  '/:questionId',
  validateRequest({ params: questionParamsSchema }),
  questionController.delete
);

export const questionRoutes = router;
