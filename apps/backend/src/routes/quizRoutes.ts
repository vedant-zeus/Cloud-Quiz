import { Router } from 'express';
import { quizController } from '../controllers/quizController.js';
import { questionRoutes } from './questionRoutes.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createQuizSchema,
  updateQuizSchema,
  quizIdParamSchema,
  listQuizzesQuerySchema,
} from '../schemas/quizSchemas.js';

const router = Router();

// Protected for authenticated hosts only
router.use(authenticate);
router.use(csrfProtection);

router.post(
  '/',
  validateRequest({ body: createQuizSchema }),
  quizController.create
);

router.get(
  '/',
  validateRequest({ query: listQuizzesQuerySchema }),
  quizController.list
);

router.get('/metrics', quizController.getMetrics);

router.get(
  '/:id',
  validateRequest({ params: quizIdParamSchema }),
  quizController.getById
);

router.patch(
  '/:id',
  validateRequest({ params: quizIdParamSchema, body: updateQuizSchema }),
  quizController.update
);

router.delete(
  '/:id',
  validateRequest({ params: quizIdParamSchema }),
  quizController.delete
);

router.post(
  '/:id/publish',
  validateRequest({ params: quizIdParamSchema }),
  quizController.publish
);

router.post(
  '/:id/archive',
  validateRequest({ params: quizIdParamSchema }),
  quizController.archive
);

// Nested question routes
router.use('/:id/questions', questionRoutes);

export const quizRoutes = router;
