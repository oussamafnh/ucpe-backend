import { Request, Response, NextFunction } from 'express';
import { AppError }  from '../utils/AppError';
import { logger }    from '../utils/logger';

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Unexpected / programming error
  logger.error(err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
