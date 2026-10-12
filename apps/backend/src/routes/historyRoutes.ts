import { Router } from 'express';
import { sessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validate.js';
import { historyQuerySchema, sessionIdParamSchema } from '../schemas/sessionSchemas.js';

const router = Router();

// Host lists their completed/historical competitions
router.get(
  '/',
  authenticate,
  validateRequest({ query: historyQuerySchema }),
  sessionController.getHistory
);

// Host inspects historical competition details & analytics
router.get(
  '/:sessionId',
  authenticate,
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.getHistoryDetail
);

export const historyRoutes = router;
