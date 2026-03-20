import { Request, Response } from 'express';
import bcrypt                 from 'bcryptjs';
import { asyncHandler }       from '../utils/asyncHandler';
import { AppError }           from '../utils/AppError';
import { UserModel }          from '../models/User.model';
import { PasswordResetModel } from '../models/passwordReset.model';
import { sendOtpEmail }       from '../utils/mailer';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/password-reset/request
export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.body.email ?? '').toString().trim();

  console.log('[password-reset/request] email:', email);

  if (!email) throw new AppError('Email requis', 400);

  const user = await UserModel.findByEmail(email);
  console.log('[password-reset/request] user found:', !!user, user?.email);

  if (!user) throw new AppError('Aucun compte associé à cet email.', 404);

  const otp       = generateOtp();
  const hashed    = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const key       = user.email.toLowerCase(); // store by lowercase email as key

  await PasswordResetModel.upsert(key, hashed, expiresAt);
  await sendOtpEmail(user.email, otp); // send to original casing

  console.log('[password-reset/request] OTP sent, expires:', expiresAt);
  res.json({ success: true });
});

// POST /api/password-reset/verify
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.body.email ?? '').toString().trim().toLowerCase();
  const otp   = (req.body.otp   ?? '').toString().trim();

  console.log('[password-reset/verify] email:', email, 'otp:', otp);

  if (!email || !otp) throw new AppError('Email et code requis', 400);

  const record = await PasswordResetModel.findByEmail(email);
  console.log('[password-reset/verify] record:', record ? { used: record.used, expires: record.expiresAt } : null);

  if (!record)                                 throw new AppError('Code invalide.', 400);
  if (record.used)                             throw new AppError('Ce code a déjà été utilisé.', 400);
  if (new Date() > new Date(record.expiresAt)) throw new AppError('Code expiré.', 400);

  const valid = await bcrypt.compare(otp, record.otp);
  console.log('[password-reset/verify] valid:', valid);
  if (!valid) throw new AppError('Code incorrect.', 400);

  await PasswordResetModel.markUsed(email);
  res.json({ success: true });
});

// POST /api/password-reset/reset
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const email       = (req.body.email       ?? '').toString().trim();
  const newPassword = (req.body.newPassword ?? '').toString();
  const key         = email.toLowerCase();

  console.log('[password-reset/reset] email:', key);

  if (!email || !newPassword) throw new AppError('Email et mot de passe requis', 400);
  if (newPassword.length < 8)  throw new AppError('Mot de passe trop court (8 min)', 400);

  const user = await UserModel.findByEmail(email);
  if (!user) throw new AppError('Utilisateur introuvable.', 404);

  const record = await PasswordResetModel.findByEmail(key);
  if (!record || !record.used) throw new AppError('Vérification OTP requise.', 403);

  const hashed = await bcrypt.hash(newPassword, 12);
  await UserModel.update(user.id, { password: hashed });
  await PasswordResetModel.deleteByEmail(key);

  console.log('[password-reset/reset] password updated for:', key);
  res.json({ success: true });
});