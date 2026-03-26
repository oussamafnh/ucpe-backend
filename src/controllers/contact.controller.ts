import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ContactModel } from '../models/contact.model';
import { sendReplyEmail } from '../utils/mailer';

// GET /api/contact — admin only
export const listMessages = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await ContactModel.findAll();

  // Annotate each message with whether it has been replied to
  const withReplyFlag = await Promise.all(
    messages.map(async (m) => ({
      ...m,
      replied: await ContactModel.hasReplies(m.id),
    }))
  );

  res.json({ success: true, data: withReplyFlag });
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
  const created  = await ContactModel.findById(insertId);
  res.status(201).json({ success: true, data: created });
});

// PATCH /api/contact/:id/read — admin only
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const id   = Number(req.params.id as string);
  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  await ContactModel.markAsRead(id);
  res.json({ success: true });
});

// DELETE /api/contact/:id — admin only
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const id   = Number(req.params.id as string);
  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  await ContactModel.delete(id);
  res.json({ success: true, message: 'Deleted' });
});

// POST /api/contact/:id/reply — admin only
export const replyToMessage = asyncHandler(async (req: Request, res: Response) => {
  const id      = Number(req.params.id as string);
  const subject = (req.body.subject ?? '').toString().trim();
  const body    = (req.body.body    ?? '').toString().trim();

  if (!subject || !body) {
    res.status(400).json({ success: false, message: 'Sujet et message requis' });
    return;
  }

  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  // Send email
  await sendReplyEmail(item.email, subject, body, item.sujet);

  // Persist reply
  const replyId = await ContactModel.createReply({ contact_id: id, subject, body });

  // Auto-mark as read on reply
  if (!item.read) await ContactModel.markAsRead(id);

  const replies = await ContactModel.findRepliesByContactId(id);
  res.json({ success: true, data: { replyId, replies } });
});

// GET /api/contact/:id/replies — admin only
export const getReplies = asyncHandler(async (req: Request, res: Response) => {
  const id   = Number(req.params.id as string);
  const item = await ContactModel.findById(id);
  if (!item) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  const replies = await ContactModel.findRepliesByContactId(id);
  res.json({ success: true, data: replies });
});