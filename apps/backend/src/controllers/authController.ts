import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createCsrfToken, setCsrfCookie } from '../middleware/csrf.js';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string): void {
  const isSecure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : env.isProduction;
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookies(res: Response): void {
  const isSecure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : env.isProduction;
  res.clearCookie('token', {
    httpOnly: true,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/',
  });
  res.clearCookie('XSRF-TOKEN', {
    httpOnly: false,
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/',
  });
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await authService.register(req.body);
      setAuthCookie(res, token);
      const csrfToken = createCsrfToken();
      setCsrfCookie(res, csrfToken);

      sendSuccess(
        res,
        { user, token, csrfToken },
        'Host registration successful',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await authService.login(req.body);
      setAuthCookie(res, token);
      const csrfToken = createCsrfToken();
      setCsrfCookie(res, csrfToken);

      sendSuccess(
        res,
        { user, token, csrfToken },
        'Host login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      clearAuthCookies(res);
      sendSuccess(res, null, 'Successfully logged out');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.user!.id);
      sendSuccess(res, { user }, 'Host profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getCsrf(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csrfToken = createCsrfToken();
      setCsrfCookie(res, csrfToken);
      sendSuccess(res, { csrfToken }, 'CSRF token issued');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
