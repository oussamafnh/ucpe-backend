import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ContactModel } from '../models/contact.model';

// GET /api/contact — admin only
export const listMessages = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await ContactModel.findAll();
  res.json({ success: true, data: messages });
});

// GET /api/contact/unread-count — admin only
export const getUnreadCount = asyncHandler(async (_req: Request, res: Response) => {
  const count = await ContactModel.countUnread();
  res.json({ success: true, data: { count } });
});

// POST /api/contact — public
export const submitMessage = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, sujet, message } = req.body;
  const insertId = await ContactModel.create({ name, email, sujet, message });
  const created = await ContactModel.findById(insertId);
  res.status(201).json({ success: true, data: created });
});

// PATCH /api/contact/:id/read — admin only
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const id = Number((req.params.id as string));
  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  await ContactModel.markAsRead(id);
  res.json({ success: true });
});

// DELETE /api/contact/:id — admin only
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = Number((req.params.id as string));
  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  await ContactModel.delete(id);
  res.json({ success: true, message: 'Deleted' });
});
