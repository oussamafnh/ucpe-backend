import { Response } from 'express';
import { CodePromoModel } from '../models/CodePromo.model';
import { AppError }       from '../utils/AppError';
import { asyncHandler }   from '../utils/asyncHandler';
import { AuthRequest }    from '../types';

// ── Admin ────────────────────────────────────────────────────────────────────

export const listCodePromos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page     = Math.max(1, parseInt(req.query['pagination[page]']     as string || '1',  10));
  const pageSize = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '50', 10));
  const activeQs = req.query['filters[active]'];
  const active   = activeQs === undefined ? undefined : activeQs === 'true' || activeQs === '1';

  const { rows, total } = await CodePromoModel.findAll({ active, page, pageSize });
  res.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const getCodePromoById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const promo = await CodePromoModel.findById(parseInt(req.params.id as string, 10));
  if (!promo) throw new AppError('Code promo introuvable', 404);
  res.json({ success: true, data: promo });
});

export const createCodePromo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { code, value, maxUses } = req.body;

  const existing = await CodePromoModel.findByCode(code);
  if (existing) throw new AppError('Ce code existe déjà', 409);

  const id = await CodePromoModel.create({ code, value, maxUses });
  res.status(201).json({ success: true, data: await CodePromoModel.findById(id) });
});

export const updateCodePromo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id    = parseInt(req.params.id as string, 10);
  const promo = await CodePromoModel.findById(id);
  if (!promo) throw new AppError('Code promo introuvable', 404);

  const { code, value, maxUses, active } = req.body;

  if (code && code.toUpperCase() !== promo.code) {
    const existing = await CodePromoModel.findByCode(code);
    if (existing) throw new AppError('Ce code existe déjà', 409);
  }

  await CodePromoModel.update(id, { code, value, maxUses, active });
  res.json({ success: true, data: await CodePromoModel.findById(id) });
});

export const deleteCodePromo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id    = parseInt(req.params.id as string, 10);
  const promo = await CodePromoModel.findById(id);
  if (!promo) throw new AppError('Code promo introuvable', 404);
  await CodePromoModel.delete(id);
  res.json({ success: true, message: 'Code promo supprimé' });
});

// ── Public / Client ──────────────────────────────────────────────────────────

export const validateCodePromo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const code = ((req.query.code as string) || '').trim().toUpperCase();
  if (!code) throw new AppError('Code requis', 400);

  const promo = await CodePromoModel.findByCode(code);
  if (!promo || !promo.active) throw new AppError('Code invalide ou désactivé', 404);

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw new AppError("Ce code a atteint sa limite d'utilisation", 410);
  }

  res.json({
    success: true,
    data: {
      id:    promo.id,
      code:  promo.code,
      value: promo.value, 
    },
  });
});