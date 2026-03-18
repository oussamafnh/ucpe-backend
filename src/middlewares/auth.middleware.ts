import { Response, NextFunction } from 'express';
import { verifyToken }               from '../utils/jwt';
import { AppError }                  from '../utils/AppError';
import { UserModel }                 from '../models/User.model';
import { AuthRequest, UserRole }     from '../types';

/**
 * Extracts the JWT from the signed HttpOnly cookie (set on login).
 * No Authorization header required — cookie is sent automatically by the browser.
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token: string | undefined = req.signedCookies?.jwt;
    if (!token) throw new AppError('Not authenticated — please log in', 401);

    req.user = verifyToken(token);
    next();
  } catch (err: any) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired session — please log in again', 401));
  }
}

/**
 * Middleware factory — checks role AND whether user is still active (not blocked/deleted).
 */
export function authorize(...roles: UserRole[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Not authenticated', 401);

      // Re-check the DB so revoked/blocked users are rejected immediately
      const user = await UserModel.findById(req.user.id);
      if (!user)          throw new AppError('User no longer exists', 401);
      if (user.blocked)   throw new AppError('Account is blocked', 403);
      if (!roles.includes(user.role))
        throw new AppError('You do not have permission to perform this action', 403);

      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}
