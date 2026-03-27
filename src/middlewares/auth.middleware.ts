import { Response, NextFunction } from 'express';
import { verifyToken }               from '../utils/jwt';
import { AppError }                  from '../utils/AppError';
import { UserModel }                 from '../models/User.model';
import { EmployeeModel }             from '../models/Employee.model';
import { AuthRequest, UserRole }     from '../types';

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
 * Role-based guard. Admins always pass.
 * Employees pass only if their role is in the list AND they have the required page permission.
 */
export function authorize(...roles: UserRole[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Not authenticated', 401);

      const user = await UserModel.findById(req.user.id);
      if (!user)        throw new AppError('User no longer exists', 401);
      if (user.blocked) throw new AppError('Account is blocked', 403);
      if (!roles.includes(user.role))
        throw new AppError('You do not have permission to perform this action', 403);

      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Page-key guard for employee routes.
 * - admin: always passes
 * - employee: must have pageKey in employee_permissions
 * - others: rejected
 */
export function authorizeEmployee(pageKey: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Not authenticated', 401);

      const user = await UserModel.findById(req.user.id);
      if (!user)        throw new AppError('User no longer exists', 401);
      if (user.blocked) throw new AppError('Account is blocked', 403);

      if (user.role === 'admin') {
        req.user = { id: user.id, email: user.email, role: user.role };
        return next();
      }

      if (user.role === 'employee') {
        const perms = await EmployeeModel.getPermissions(user.id);
        if (!perms.includes(pageKey))
          throw new AppError('Access to this section is not permitted', 403);
        req.user = { id: user.id, email: user.email, role: user.role };
        return next();
      }

      throw new AppError('You do not have permission to perform this action', 403);
    } catch (err) {
      next(err);
    }
  };
}