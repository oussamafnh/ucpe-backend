import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate }                from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getProducts,
  getProductBySlug,
  getProductVariants,
  getProductStats,
  getVariantGroups,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleStock,
  setDiscount,
  setVariant,
} from '../controllers/product.controller';

const router = Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/',                getProducts);
router.get('/stats',           authenticate, authorize('admin'), getProductStats);
router.get('/variant-groups',  authenticate, authorize('admin'), getVariantGroups);
router.get('/:slug',           getProductBySlug);
router.get('/:slug/variants',  getProductVariants);

// ── Admin — create ─────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate, authorize('admin'),
  createProduct,
);

// ── Admin — update ─────────────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  updateProduct,
);

router.patch(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  updateProduct,
);

// ── Admin — stock ──────────────────────────────────────────────────────────────
router.patch(
  '/:id/stock',
  authenticate, authorize('admin'),
  [param('id').isInt(), body('inStock').isBoolean()], validate,
  toggleStock,
);

// ── Admin — discount ───────────────────────────────────────────────────────────
router.patch(
  '/:id/discount',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  setDiscount,
);

// ── Admin — variant ────────────────────────────────────────────────────────────
router.patch(
  '/:id/variant',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  setVariant,
);

// ── Admin — delete ─────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  deleteProduct,
);

export default router;