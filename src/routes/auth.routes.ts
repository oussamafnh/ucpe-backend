import { Router } from 'express';
import { body }   from 'express-validator';
import { validate }        from '../middlewares/validate';
import { authenticate }    from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/rateLimiter';
import {
  register,
  login,
  logout,
  verifyAccount,
  resendActivation,
} from '../controllers/auth.controller';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  [
    body('firstName').notEmpty().trim().escape(),
    body('lastName').notEmpty().trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  register,
);

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login,
);

router.post(
  '/verify-account',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  validate,
  verifyAccount,
);

router.post(
  '/resend-activation',
  authRateLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  resendActivation,
);

router.post('/logout', authenticate, logout);

export default router;