import { Response } from 'express';
import { DevisNotificationEmailModel } from '../models/DevisNotificationEmail.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { AuthRequest } from '../types';

export const listNotifEmails = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await DevisNotificationEmailModel.findAll() });
});

export const createNotifEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, label } = req.body as { email: string; label?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Invalid email address', 400);
  }
  const created = await DevisNotificationEmailModel.create(email, label);
  res.status(201).json({ success: true, data: created });
});

export const updateNotifEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { email, label, active } = req.body as { email?: string; label?: string; active?: boolean };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Invalid email address', 400);
  }
  const updated = await DevisNotificationEmailModel.update(id, { email, label, active });
  if (!updated) throw new AppError('Not found', 404);
  res.json({ success: true, data: updated });
});

export const deleteNotifEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const existing = await DevisNotificationEmailModel.findById(id);
  if (!existing) throw new AppError('Not found', 404);
  await DevisNotificationEmailModel.delete(id);
  res.json({ success: true, message: 'Deleted' });
});