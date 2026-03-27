import rateLimit from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  message: { success: false, message: 'Too many requests, please try again later.' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});