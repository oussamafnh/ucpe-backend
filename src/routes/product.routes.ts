import { Router }      from 'express';
import { body, param }  from 'express-validator';
import { validate }     from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getProductStats,
  getVariantGroups,
  getProducts,
  getProductBySlug,
  getProductVariants,
  createProduct,
  updateProduct,
  toggleStock,
  setDiscount,
  deleteProduct,
  setVariant,
} from '../controllers/product.controller';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getProducts);

// !! All literal paths MUST come before /:slug
router.get('/stats',          authenticate, authorize('admin'), getProductStats);
router.get('/variant-groups', authenticate, authorize('admin'), getVariantGroups);

router.get('/:slug',          getProductBySlug);
router.get('/:slug/variants', getProductVariants);

// ── Admin only ────────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate, authorize('admin'),
  [body('title').notEmpty().trim()],
  validate,
  createProduct
);

router.put(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  updateProduct
);

router.patch(
  '/:id/stock',
  authenticate, authorize('admin'),
  [param('id').isInt(), body('inStock').isBoolean()],
  validate,
  toggleStock
);

router.patch(
  '/:id/discount',
  authenticate, authorize('admin'),
  [param('id').isInt(), body('discountPercent').isInt({ min: 0, max: 100 })],
  validate,
  setDiscount
);

router.patch(
  '/:id/variant',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('isInVariant').isBoolean(),
    body('variantId').custom((val) => {
      if (val !== null && typeof val !== 'string') {
        throw new Error('variantId must be a string or null');
      }
      return true;
    }),
  ],
  validate,
  setVariant
);

router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  deleteProduct
);

export default router;