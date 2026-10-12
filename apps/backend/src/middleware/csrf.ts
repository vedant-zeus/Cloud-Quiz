import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { ForbiddenError } from '../utils/errors.js';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function createCsrfToken(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256', env.CSRF_SECRET).update(randomBytes).digest('hex');
  return `${randomBytes}.${signature}`;
}

export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [randomBytes, signature] = parts;
  const expected = crypto.createHmac('sha256', env.CSRF_SECRET).update(randomBytes).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function setCsrfCookie(res: Response, token: string): void {
  const isSecure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : env.isProduction;
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Accessible by JavaScript so frontend Axios can read it
    secure: isSecure,
    sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/',
  });
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt public registration, login, and test environment if test flag set
  const exemptPaths = ['/api/v1/auth/login', '/api/v1/auth/register'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  // If request is authenticated via Bearer header directly (e.g., API clients, Vitest), exempt
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // In test environment, allow passing if no cookie is set
  if (env.isTest && !req.cookies?.token) {
    return next();
  }

  // When cookie-based authentication is used, enforce CSRF protection
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

  if (!headerToken || !verifyCsrfToken(headerToken)) {
    return next(new ForbiddenError('Invalid or missing CSRF token'));
  }

  if (cookieToken && headerToken !== cookieToken) {
    return next(new ForbiddenError('CSRF token mismatch'));
  }

  next();
}
