import { Request, Response } from 'express';
import { ProductModel }      from '../models/Product.model';
import { AppError }          from '../utils/AppError';
import { asyncHandler }      from '../utils/asyncHandler';
import { uniqueSlug }        from '../utils/slugify';
import pool                  from '../database/connection';

// ── Product stats (admin overview) ───────────────────────────────────────────

export const getProductStats = asyncHandler(async (req: Request, res: Response) => {
  const [[stats]] = await (pool as any).query(`
    SELECT
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN inStock = 1 THEN 1 ELSE 0 END)                   AS inStock,
      SUM(CASE WHEN inStock = 0 THEN 1 ELSE 0 END)                   AS outOfStock,
      SUM(CASE WHEN isInVariant = 1 THEN 1 ELSE 0 END)               AS variantProducts,
      COUNT(DISTINCT CASE WHEN isInVariant = 1 THEN variantId END)   AS variantGroups,
      SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END)                 AS noPriceCount
    FROM products
  `);

  res.json({
    success: true,
    data: {
      total:           Number(stats.total),
      inStock:         Number(stats.inStock),
      outOfStock:      Number(stats.outOfStock),
      variantProducts: Number(stats.variantProducts),
      variantGroups:   Number(stats.variantGroups),
      noPriceCount:    Number(stats.noPriceCount),
    },
  });
});

// ── Variant groups ────────────────────────────────────────────────────────────

export const getVariantGroups = asyncHandler(async (req: Request, res: Response) => {
  const page     = Math.max(1, parseInt(req.query['pagination[page]']       as string || '1',  10));
  const pageSize = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '20', 10));
  const search   = req.query['search'] as string | undefined;

  const { groups, total } = await ProductModel.findVariantGroups({ search, page, pageSize });

  res.json({
    success: true,
    data: groups,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ── Public / shared list ──────────────────────────────────────────────────────

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page         = Math.max(1, parseInt(req.query['pagination[page]']       as string || '1',  10));
  const pageSize     = Math.min(100, parseInt(req.query['pagination[pageSize]'] as string || '20', 10));
  const categorySlug = req.query['filters[category][slug][$eq]'] as string | undefined;
  const variantId    = req.query['filters[variantId][$eq]']      as string | undefined;
  const inStockRaw   = req.query['filters[inStock][$eq]']        as string | undefined;
  const inStock      = inStockRaw === 'true' ? true : inStockRaw === 'false' ? false : undefined;

  const isInVariantRaw = req.query['filters[isInVariant][$eq]'] as string | undefined;
  const isInVariant    = isInVariantRaw === 'true' ? true : isInVariantRaw === 'false' ? false : undefined;

  const search   = req.query['search']   as string | undefined;
  const minPrice = req.query['minPrice'] ? parseFloat(req.query['minPrice'] as string) : undefined;
  const maxPrice = req.query['maxPrice'] ? parseFloat(req.query['maxPrice'] as string) : undefined;

  const isAdmin = req.query['admin'] === '1';

  const { products, total } = await ProductModel.findAll({
    categorySlug, inStock, isInVariant, variantId, search, minPrice, maxPrice, page, pageSize,
    collapseVariants: !isAdmin,
  });

  res.json({
    success: true,
    data: products,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ── Single product ────────────────────────────────────────────────────────────

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductModel.findBySlug(req.params.slug as string);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: product });
});

// ── Variants for a product ────────────────────────────────────────────────────

export const getProductVariants = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductModel.findBySlug(req.params.slug as string);
  if (!product) throw new AppError('Product not found', 404);
  if (!product.isInVariant || !product.variantId) {
    return res.json({ success: true, data: [] });
  }
  const variants = await ProductModel.findVariants(product.variantId);
  res.json({ success: true, data: variants });
});

// ── Create ────────────────────────────────────────────────────────────────────

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const slug = await uniqueSlug(req.body.title, 'products');
  const body = { ...req.body };

  // Resolve isForSell — default true
  body.isForSell = body.isForSell !== undefined
    ? (body.isForSell === true || body.isForSell === 'true' || body.isForSell === 1)
    : true;

  // ficheTechnique — allow null/empty
  body.ficheTechnique = body.ficheTechnique?.trim() || null;

  if (body.price != null) {
    const base = parseFloat(body.price);
    const pct  = Math.min(100, Math.max(0, parseInt(body.discountPercent || 0, 10)));
    const euro = body.discountEuro != null ? parseFloat(body.discountEuro) : null;

    // Always store the entered price as originalPrice
    body.originalPrice = base;

    if (euro != null && euro > 0) {
      body.price           = parseFloat(Math.max(0, base - euro).toFixed(2));
      body.discountEuro    = euro;
      body.discountPercent = base > 0 ? Math.round((euro / base) * 100) : 0;
    } else if (pct > 0) {
      body.price           = parseFloat((base * (1 - pct / 100)).toFixed(2));
      body.discountEuro    = null;
      body.discountPercent = pct;
    } else {
      body.price           = base;
      body.discountEuro    = null;
      body.discountPercent = 0;
    }
  }

  const id      = await ProductModel.create({ ...body, slug });
  const product = await ProductModel.findById(id);
  res.status(201).json({ success: true, data: product });
});

// ── Update ────────────────────────────────────────────────────────────────────

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (req.body.title) {
    req.body.slug = await uniqueSlug(req.body.title, 'products', id);
  }

  const body     = { ...req.body };
  const existing = await ProductModel.findById(id);
  if (!existing) throw new AppError('Product not found', 404);

  // isForSell
  if (body.isForSell !== undefined) {
    body.isForSell = body.isForSell === true || body.isForSell === 'true' || body.isForSell === 1;
  }

  // ficheTechnique
  if (body.ficheTechnique !== undefined) {
    body.ficheTechnique = body.ficheTechnique?.trim() || null;
  }

  // ── Price / discount resolution ──────────────────────────────────────────
  // We only recalculate if any price-related field is being touched
  const touchingPrice = body.price != null || body.discountPercent != null || body.discountEuro !== undefined;

  if (touchingPrice) {
    // The "base" is always the original (pre-discount) price.
    // If the request sends a new `price` and no discount, treat that as the new base.
    // If the request sends a new `price` WITH a discount, also treat it as the new base.
    // The only exception: if price is NOT in the request, keep the existing originalPrice.
    const base = parseFloat(String(
      body.price != null
        ? body.price                                   // new base from form
        : (existing.originalPrice ?? existing.price ?? 0)  // keep existing base
    ));

    // discountEuro: explicit null means "remove euro discount"; undefined means "don't change"
    const euroRaw = body.discountEuro !== undefined
      ? body.discountEuro
      : existing.discountEuro;

    const euro = euroRaw != null ? parseFloat(String(euroRaw)) : null;

    const pct = body.discountPercent != null
      ? Math.min(100, Math.max(0, parseInt(String(body.discountPercent), 10)))
      : (euro == null || euro === 0 ? (existing.discountPercent ?? 0) : 0);

    body.originalPrice = base;

    if (euro != null && euro > 0) {
      body.price           = parseFloat(Math.max(0, base - euro).toFixed(2));
      body.discountEuro    = euro;
      body.discountPercent = base > 0 ? Math.round((euro / base) * 100) : 0;
    } else if (pct > 0 && (euro == null || euro === 0)) {
      body.price           = parseFloat((base * (1 - pct / 100)).toFixed(2));
      body.discountEuro    = null;
      body.discountPercent = pct;
    } else {
      // No discount — price equals base
      body.price           = base;
      body.discountEuro    = null;
      body.discountPercent = 0;
    }
  }

  await ProductModel.update(id, body);
  res.json({ success: true, data: await ProductModel.findById(id) });
});

// ── Toggle stock ──────────────────────────────────────────────────────────────

export const toggleStock = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  await ProductModel.update(id, { inStock: req.body.inStock });
  res.json({ success: true, data: await ProductModel.findById(id) });
});

// ── Set discount ──────────────────────────────────────────────────────────────
// Supports both % and € modes.
// Critically: always uses `originalPrice` as the base so repeated
// calls don't compound or lose the real starting price.

export const setDiscount = asyncHandler(async (req: Request, res: Response) => {
  const id   = parseInt(req.params.id as string, 10);
  const mode = (req.body.discountMode as 'percent' | 'euro' | undefined) ?? 'percent';

  const product = await ProductModel.findById(id);
  if (!product) throw new AppError('Product not found', 404);

  // Always derive from originalPrice — this is the untouched base.
  // If originalPrice was never set (legacy data), fall back to current price.
  const base: number = parseFloat(String(product.originalPrice ?? product.price ?? 0));

  let newPrice: number;
  let pct: number;
  let euro: number | null = null;

  if (mode === 'euro') {
    const rawEuro = parseFloat(String(req.body.discountEuro ?? 0));
    euro = Math.max(0, rawEuro);

    if (euro === 0) {
      // Remove discount — restore to base
      newPrice = base;
      pct      = 0;
      euro     = null;
    } else {
      newPrice = parseFloat(Math.max(0, base - euro).toFixed(2));
      pct      = base > 0 ? Math.round((euro / base) * 100) : 0;
    }
  } else {
    // percent mode
    pct = Math.min(100, Math.max(0, parseInt(String(req.body.discountPercent ?? 0), 10)));

    if (pct === 0) {
      // Remove discount — restore to base
      newPrice = base;
    } else {
      newPrice = parseFloat((base * (1 - pct / 100)).toFixed(2));
    }
  }

  await ProductModel.update(id, {
    discountPercent: pct,
    discountEuro:    euro,
    price:           newPrice,
    originalPrice:   base,  // always persist the base so future calls stay correct
  });

  res.json({ success: true, data: await ProductModel.findById(id) });
});

// ── Delete ────────────────────────────────────────────────────────────────────

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await ProductModel.delete(parseInt(req.params.id as string, 10));
  res.json({ success: true, message: 'Product deleted' });
});

// ── Set variant ───────────────────────────────────────────────────────────────

export const setVariant = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  await ProductModel.update(id, {
    isInVariant: req.body.isInVariant,
    variantId:   req.body.variantId,
  });
  res.json({ success: true, data: await ProductModel.findById(id) });
});