import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // Check cookies first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check authorization header (Bearer)
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing');
    }

    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
