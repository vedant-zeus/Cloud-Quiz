import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class HealthController {
  async health(_req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      'Service is healthy'
    );
  }

  async ready(_req: Request, res: Response): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      sendSuccess(
        res,
        {
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
        'Service is ready'
      );
    } catch (error) {
      sendError(
        res,
        'SERVICE_UNAVAILABLE',
        'Database connection failed',
        503,
        [{ message: error instanceof Error ? error.message : 'Unknown error' }]
      );
    }
  }
}

export const healthController = new HealthController();
