import { Response }    from 'express';
import { DevisModel }  from '../models/Devis.model';
import { ProductModel } from '../models/Product.model';
import { UserModel }   from '../models/User.model';
import { sendEmail }   from '../utils/email';
import { AppError }    from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../types';

export const submitDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items, message, dateEvenement, nombreJours, delivery, pickup, codePromo } = req.body as {
    items: { productId: number; quantity: number }[];
    message?: string;
    dateEvenement?: string;
    nombreJours?: number;
    delivery?: any;
    pickup?: any;
    codePromo?: string;
  };

  const snapshotItems = await Promise.all(
    items.map(async (item) => {
      const p = await ProductModel.findById(item.productId);
      if (!p) throw new AppError(`Product ${item.productId} not found`, 404);
      return { productId: p.id, title: p.title, price: p.price, quantity: item.quantity, images: p.images || [] };
    })
  );

  const id = await DevisModel.create({
    userId: req.user!.id, items: snapshotItems, message,
    dateEvenement, nombreJours, delivery, pickup, codePromo,
  });

  const devis = await DevisModel.findById(id);
  res.status(201).json({ success: true, data: devis });
});

export const listDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page     = Math.max(1, parseInt(req.query['pagination[page]']     as string || '1',  10));
  const pageSize = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '20', 10));
  const status   = req.query['filters[status][$eq]'] as any;
  const { rows, total } = await DevisModel.findAll({ status, page, pageSize });
  res.json({ success: true, data: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

export const getMyDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await DevisModel.findByUser(req.user!.id);
  res.json({ success: true, data });
});

export const getDevisById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const devis = await DevisModel.findById(parseInt((req.params.id as string) as string, 10));
  if (!devis) throw new AppError('Quote not found', 404);
  res.json({ success: true, data: devis });
});

export const updateDevisStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, adminNote, totalFinal } = req.body;
  const id = parseInt((req.params.id as string) as string, 10);

  // totalFinal: accept number or null explicitly; undefined = don't touch it
  const finalValue = totalFinal !== undefined
    ? (totalFinal === null || totalFinal === '' ? null : parseFloat(totalFinal))
    : undefined;

  await DevisModel.updateStatus(id, status, adminNote, finalValue);
  res.json({ success: true, data: await DevisModel.findById(id) });
});

export const sendDevisEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const devis = await DevisModel.findById(parseInt((req.params.id as string) as string, 10));
  if (!devis) throw new AppError('Quote not found', 404);
  const user = await UserModel.findById(devis.userId);
  if (!user) throw new AppError('User not found', 404);

  const { subject, message, attachmentUrl } = req.body;
  await sendEmail({
    to: user.email, subject,
    html: `<p>Bonjour ${user.firstName},</p><p>${message}</p>${attachmentUrl ? `<p><a href="${attachmentUrl}">Télécharger votre devis</a></p>` : ''}`,
  });

  await DevisModel.updateStatus(devis.id, 'sent');
  res.json({ success: true, message: 'Email sent and status updated to sent' });
});

export const deleteDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  await DevisModel.delete(parseInt((req.params.id as string) as string, 10));
  res.json({ success: true, message: 'Quote deleted' });
});