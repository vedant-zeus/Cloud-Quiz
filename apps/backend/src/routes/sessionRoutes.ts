import { Router } from 'express';
import { sessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validateRequest } from '../middleware/validate.js';
import { createSessionSchema, roomCodeParamSchema } from '../schemas/sessionSchemas.js';

const router = Router();

// Host creates session
router.post(
  '/',
  authenticate,
  csrfProtection,
  validateRequest({ body: createSessionSchema }),
  sessionController.create
);

// Public room information
router.get(
  '/:roomCode',
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.getRoomInfo
);

// Final or host-only results
router.get(
  '/:roomCode/results',
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.getResults
);

// Host-only competition analytics
router.get(
  '/:roomCode/analytics',
  authenticate,
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.getAnalytics
);

// Participant personal results review
router.get(
  '/:roomCode/participant-results',
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.getParticipantResults
);

// Host-only CSV export: Leaderboard
router.get(
  '/:roomCode/export/leaderboard.csv',
  authenticate,
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.exportLeaderboard
);

// Host-only CSV export: Answers
router.get(
  '/:roomCode/export/answers.csv',
  authenticate,
  validateRequest({ params: roomCodeParamSchema }),
  sessionController.exportAnswers
);

export const sessionRoutes = router;
