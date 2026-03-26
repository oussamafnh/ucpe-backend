import { Response }     from 'express';
import { DevisModel }   from '../models/Devis.model';
import { ProductModel } from '../models/Product.model';
import { UserModel }    from '../models/User.model';
import { CodePromoModel } from '../models/CodePromo.model';
import { sendDevisReplyEmail, sendNewDevisAdminEmail } from '../utils/mailer';
import { AppError }     from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest }  from '../types';

export const submitDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items, message, dateEvenement, nombreJours, delivery, pickup, codePromo } = req.body as {
    items: { productId: number; quantity: number }[];
    message?: string; dateEvenement?: string; nombreJours?: number;
    delivery?: any; pickup?: any; codePromo?: string;
  };

  const snapshotItems = await Promise.all(items.map(async (item) => {
    const p = await ProductModel.findById(item.productId);
    if (!p) throw new AppError(`Product ${item.productId} not found`, 404);
    return { productId: p.id, title: p.title, price: p.price, quantity: item.quantity, images: p.images || [] };
  }));

  // Validate promo code if provided and increment usage
  let validatedPromoCode: string | undefined = undefined;
  if (codePromo && codePromo.trim() !== '') {
    const promo = await CodePromoModel.findByCode(codePromo.trim());
    if (promo && promo.active) {
      // Check usage limit
      if (promo.maxUses === null || promo.usedCount < promo.maxUses) {
        validatedPromoCode = promo.code;
        await CodePromoModel.incrementUsed(promo.id);
      }
    }
  }

  const id = await DevisModel.create({
    userId: req.user!.id,
    items: snapshotItems,
    message,
    dateEvenement,
    nombreJours,
    delivery,
    pickup,
    codePromo: validatedPromoCode,
  });

  const savedDevis = await DevisModel.findById(id);

  // Notify admin — fire-and-forget (don't block the response if email fails)
  const totalProduits = snapshotItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const clientUser = await UserModel.findById(req.user!.id).catch(() => null);
  // Fetch promo % for the email if a code was applied
  let promoValue: number | undefined = undefined;
  if (validatedPromoCode) {
    const promoRecord = await CodePromoModel.findByCode(validatedPromoCode).catch(() => null);
    if (promoRecord) promoValue = promoRecord.value;
  }
  sendNewDevisAdminEmail({
    devisId: id,
    clientName:  clientUser ? `${clientUser.firstName} ${clientUser.lastName}`.trim() : `User #${req.user!.id}`,
    clientEmail: clientUser?.email ?? '',
    items: snapshotItems.map(i => ({ title: i.title, quantity: i.quantity, price: i.price })),
    dateEvenement: dateEvenement ?? undefined,
    lieuVille: delivery?.lieuVille ?? undefined,
    codePromo: validatedPromoCode ?? undefined,
    promoValue,
    totalProduits,
  }).catch(err => console.error('[mailer] Admin notification failed:', err));

  res.status(201).json({ success: true, data: savedDevis });
});

export const listDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page     = Math.max(1, parseInt(req.query['pagination[page]'] as string || '1', 10));
  const pageSize = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '20', 10));
  const status   = req.query['filters[status][$eq]'] as any;
  const { rows, total } = await DevisModel.findAll({ status, page, pageSize });
  res.json({ success: true, data: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

export const getMyDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await DevisModel.findByUser(req.user!.id) });
});

export const getDevisById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const devis = await DevisModel.findById(parseInt(req.params.id as string, 10));
  if (!devis) throw new AppError('Quote not found', 404);
  res.json({ success: true, data: devis });
});

export const updateDevisStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, adminNote, totalFinal } = req.body;
  const id = parseInt(req.params.id as string, 10);
  const finalValue = totalFinal !== undefined
    ? (totalFinal === null || totalFinal === '' ? null : parseFloat(totalFinal))
    : undefined;
  await DevisModel.updateStatus(id, status, adminNote, finalValue);
  res.json({ success: true, data: await DevisModel.findById(id) });
});

// POST /api/devis/:id/reply — send email + persist reply
export const replyToDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id         = parseInt(req.params.id as string, 10);
  const subject    = (req.body.subject ?? '').toString().trim();
  const body       = (req.body.body    ?? '').toString().trim();
  const totalFinal = req.body.totalFinal !== undefined && req.body.totalFinal !== '' && req.body.totalFinal !== null
    ? parseFloat(req.body.totalFinal)
    : null;

  if (!subject || !body) {
    res.status(400).json({ success: false, message: 'Sujet et message requis' });
    return;
  }

  const devis = await DevisModel.findById(id);
  if (!devis) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  const user = await UserModel.findById(devis.userId);
  if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

  await sendDevisReplyEmail(user.email, subject, body, totalFinal);
  await DevisModel.createReply({ devis_id: id, subject, body, totalFinal });

  // Auto-advance to 'sent' if still pending/processing
  if (devis.status === 'pending' || devis.status === 'processing') {
    await DevisModel.updateStatus(id, 'sent', undefined, totalFinal ?? undefined);
  } else if (totalFinal !== null) {
    await DevisModel.updateStatus(id, devis.status, undefined, totalFinal);
  }

  const replies = await DevisModel.findRepliesByDevisId(id);
  res.json({ success: true, data: { replies } });
});

// GET /api/devis/:id/replies
export const getDevisReplies = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const devis = await DevisModel.findById(id);
  if (!devis) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: await DevisModel.findRepliesByDevisId(id) });
});

export const deleteDevis = asyncHandler(async (req: AuthRequest, res: Response) => {
  await DevisModel.delete(parseInt(req.params.id as string, 10));
  res.json({ success: true, message: 'Quote deleted' });
});