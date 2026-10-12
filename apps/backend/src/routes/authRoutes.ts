import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerSchema }),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

router.post('/logout', authController.logout);

router.get('/me', authenticate, authController.getMe);

router.get('/csrf', authController.getCsrf);

export const authRoutes = router;
