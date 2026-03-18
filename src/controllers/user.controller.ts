import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../types';

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw new AppError('User not found', 404);
  const { password: _pw, ...data } = user;
  res.json({ success: true, data });
});

export const updateMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword, password: _ignored, ...profileFields } = req.body;

  const update: Record<string, unknown> = { ...profileFields };

  if (newPassword) {
    if (!currentPassword) throw new AppError('Le mot de passe actuel est requis.', 400);

    const user = await UserModel.findById(req.user!.id);
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Mot de passe actuel incorrect.', 401);

    if (newPassword.length < 8)
      throw new AppError('Le nouveau mot de passe doit contenir au moins 8 caractères.', 400);

    update.password = await bcrypt.hash(newPassword, 12);
  }

  await UserModel.update(req.user!.id, update);
  const updated = await UserModel.findById(req.user!.id);
  const { password: _pw, ...data } = updated!;
  res.json({ success: true, data });
});

export const deleteMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  await UserModel.delete(req.user!.id);
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true, message: 'Account deleted' });
});

export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query['pagination[page]'] as string || '1', 10));
  const pageSize = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '20', 10));
  const search = (req.query['search'] as string || '').trim();

  const { users, total } = await UserModel.findAll(page, pageSize, search);
  const sanitized = users.map(({ password: _pw, ...u }) => u);

  res.json({
    success: true,
    data: sanitized,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await UserModel.findById(parseInt((req.params.id as string) as string, 10));
  if (!user) throw new AppError('User not found', 404);
  const { password: _pw, ...data } = user;
  res.json({ success: true, data });
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt((req.params.id as string) as string, 10);
  const { password: _ignored, ...fields } = req.body;
  await UserModel.update(id, fields);
  const updated = await UserModel.findById(id);
  if (!updated) throw new AppError('User not found', 404);
  const { password: _pw, ...data } = updated;
  res.json({ success: true, data });
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  await UserModel.delete(parseInt((req.params.id as string) as string, 10));
  res.json({ success: true, message: 'User deleted' });
});


export const getUsersStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const last7Days = await UserModel.getUsersLast7Days();
  res.json({ success: true, data: last7Days });
});
