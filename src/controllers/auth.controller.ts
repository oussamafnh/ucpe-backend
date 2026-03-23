import { Request, Response } from 'express';
import bcrypt                from 'bcryptjs';
import crypto                from 'crypto';
import { UserModel }         from '../models/User.model';
import { AccountVerificationModel } from '../models/AccountVerification.model';
import { sendTokenCookie, clearTokenCookie } from '../utils/jwt';
import { sendAccountActivationEmail }        from '../utils/mailer';
import { AppError }          from '../utils/AppError';
import { asyncHandler }      from '../utils/asyncHandler';
import { AuthRequest }       from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function sanitize(u: any) {
  const { password: _pw, ...rest } = u;
  return rest;
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

// ─── register ─────────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, country, address, phone, role } = req.body;

  const exists = await UserModel.findByEmail(email);

  if (exists && exists.isActivated) {
    throw new AppError('Cette adresse email est déjà utilisée.', 409);
  }

  // If an unactivated account already exists for this email, delete it and recreate
  // (covers the case where the user closed the app before activating)
  if (exists && !exists.isActivated) {
    await UserModel.delete(exists.id);
  }

  const hashed = await bcrypt.hash(password, 12);
  const userId = await UserModel.create({
    firstName, lastName, email, password: hashed,
    country, address, phone,
    role: ['public', 'client', 'admin'].includes(role) ? role : 'client',
  });

  // Generate & store OTP
  const otp       = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await AccountVerificationModel.upsert(email, hashedOtp, expiresAt);

  // Send email (non-blocking failure — log but don't crash)
  try {
    await sendAccountActivationEmail(email, otp);
  } catch (mailErr) {
    console.error('[register] Failed to send activation email:', mailErr);
  }

  // Do NOT set cookie yet — account not activated
  res.status(201).json({
    success: true,
    message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
    data: { email },
  });
});

// ─── verify account (activate) ────────────────────────────────────────────────

export const verifyAccount = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const record = await AccountVerificationModel.findByEmail(email);
  if (!record) throw new AppError('Aucun code en attente pour cet email.', 400);
  if (record.used)  throw new AppError('Ce code a déjà été utilisé.', 400);
  if (new Date() > new Date(record.expiresAt)) {
    throw new AppError('Ce code a expiré. Veuillez vous réinscrire.', 400);
  }

  const valid = await bcrypt.compare(otp, record.otp);
  if (!valid) throw new AppError('Code incorrect.', 400);

  const user = await UserModel.findByEmail(email);
  if (!user) throw new AppError('Compte introuvable.', 404);

  // Activate the account
  await UserModel.activate(user.id);
  await AccountVerificationModel.deleteByEmail(email);

  // Now set the auth cookie
  sendTokenCookie(res, { id: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    message: 'Compte activé avec succès.',
    data: sanitize({ ...user, isActivated: true }),
  });
});

// ─── resend activation code ───────────────────────────────────────────────────

export const resendActivation = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user)              throw new AppError('Aucun compte associé à cet email.', 404);
  if (user.isActivated)   throw new AppError('Ce compte est déjà activé.', 400);

  const otp       = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await AccountVerificationModel.upsert(email, hashedOtp, expiresAt);

  try {
    await sendAccountActivationEmail(email, otp);
  } catch (mailErr) {
    console.error('[resendActivation] Failed to send email:', mailErr);
  }

  res.json({ success: true, message: 'Nouveau code envoyé.' });
});

// ─── login ────────────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user) throw new AppError('Aucun compte associé à cette adresse email.', 401);
  if (user.blocked) throw new AppError('Votre compte a été suspendu. Contactez le support.', 403);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError('Mot de passe incorrect.', 401);

  // Account not yet activated — send a fresh code and ask frontend to show OTP screen
  if (!user.isActivated) {
    const otp       = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await AccountVerificationModel.upsert(email, hashedOtp, expiresAt);

    try {
      await sendAccountActivationEmail(email, otp);
    } catch (mailErr) {
      console.error('[login] Failed to send activation email:', mailErr);
    }

    // 403 with a specific code so the frontend knows to show the OTP step
    res.status(403).json({
      success: false,
      code:    'ACCOUNT_NOT_ACTIVATED',
      message: 'Votre compte n\'est pas encore activé. Un nouveau code vous a été envoyé.',
      data:    { email },
    });
    return;
  }

  sendTokenCookie(res, { id: user.id, email: user.email, role: user.role });
  res.json({ success: true, message: 'Connexion réussie.', data: sanitize(user) });
});

// ─── logout ───────────────────────────────────────────────────────────────────

export const logout = asyncHandler(async (_req: AuthRequest, res: Response) => {
  clearTokenCookie(res);
  res.json({ success: true, message: 'Déconnexion réussie.' });
});