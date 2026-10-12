import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { quizRoutes } from './routes/quizRoutes.js';
import { sessionRoutes } from './routes/sessionRoutes.js';
import { historyRoutes } from './routes/historyRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Useful for API server communicating with SPA
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  // CORS configuration with explicit origin and credentials
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-participant-token'],
    })
  );

  // Body parsing and cookies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Health and readiness endpoints (both at root and under api prefix)
  app.use('/', healthRoutes);
  app.use(env.API_PREFIX, healthRoutes);

  // API v1 routes
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/quizzes`, quizRoutes);
  app.use(`${env.API_PREFIX}/sessions`, sessionRoutes);
  app.use(`${env.API_PREFIX}/history`, historyRoutes);

  // 404 handler for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist',
      },
    });
  });

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
