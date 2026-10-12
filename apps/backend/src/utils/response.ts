import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail } from '../types/index.js';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation completed successfully',
  statusCode = 200
): Response {
  const responseBody: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  details?: ApiErrorDetail[]
): Response {
  const responseBody: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
  return res.status(statusCode).json(responseBody);
}
