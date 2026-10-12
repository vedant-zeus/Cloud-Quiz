import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/health', healthController.health);
router.get('/ready', healthController.ready);

export const healthRoutes = router;
