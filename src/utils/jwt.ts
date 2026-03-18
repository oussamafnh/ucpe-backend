import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { JwtPayload } from '../types';

const SECRET = process.env.JWT_SECRET!;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_DAYS = parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10);

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

/**
 * Sign a JWT and attach it as an HttpOnly cookie.
 * The cookie is automatically sent on every subsequent request —
 * the frontend does NOT need to manage the token at all.
 */
export function sendTokenCookie(res: Response, payload: JwtPayload): string {
  const token = signToken(payload);

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',       // HTTPS in prod
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // ← 'none' for cross-origin
    maxAge: COOKIE_DAYS * 24 * 60 * 60 * 1000,
    signed: true,
  });

  return token;
}

export function clearTokenCookie(res: Response): void {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    signed: true,
  });
}
