import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return;
  }

  // 1. AppError (our domain errors)
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // 2. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'field';
      sendError(res, 'CONFLICT', `A resource with this unique ${target} already exists`, 409);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 'NOT_FOUND', 'The requested resource was not found', 404);
      return;
    }
  }

  // 3. JSON body parsing error
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    sendError(res, 'BAD_REQUEST', 'Malformed JSON payload received', 400);
    return;
  }

  // 4. Default unhandled error (500)
  if (!env.isTest) {
    console.error('Unhandled server error:', err);
  }

  const message = env.isProduction ? 'An unexpected internal error occurred' : err.message;
  sendError(res, 'INTERNAL_SERVER_ERROR', message, 500);
}
