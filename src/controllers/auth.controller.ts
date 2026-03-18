import { Request, Response } from 'express';
import bcrypt                   from 'bcryptjs';
import { UserModel }            from '../models/User.model';
import { sendTokenCookie, clearTokenCookie } from '../utils/jwt';
import { AppError }             from '../utils/AppError';
import { asyncHandler }         from '../utils/asyncHandler';
import { AuthRequest }          from '../types';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, country, address, phone, role } = req.body;

  const exists = await UserModel.findByEmail(email);
  if (exists) throw new AppError('Cette adresse email est déjà utilisée.', 409);

  const hashed = await bcrypt.hash(password, 12);
  const userId = await UserModel.create({
    firstName, lastName, email, password: hashed,
    country, address, phone,
    role: ['public', 'client', 'admin'].includes(role) ? role : 'client',
  });

  const user = await UserModel.findById(userId);
  sendTokenCookie(res, { id: user!.id, email: user!.email, role: user!.role });

  res.status(201).json({
    success: true,
    message: 'Compte créé avec succès.',
    data: sanitize(user!),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user) throw new AppError('Aucun compte associé à cette adresse email.', 401);
  if (user.blocked) throw new AppError('Votre compte a été suspendu. Contactez le support.', 403);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError('Mot de passe incorrect.', 401);

  sendTokenCookie(res, { id: user.id, email: user.email, role: user.role });

  res.json({ success: true, message: 'Connexion réussie.', data: sanitize(user) });
});

export const logout = asyncHandler(async (_req: AuthRequest, res: Response) => {
  clearTokenCookie(res);
  res.json({ success: true, message: 'Déconnexion réussie.' });
});

function sanitize(u: any) {
  const { password: _pw, ...rest } = u;
  return rest;
}