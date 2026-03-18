import { Router }     from 'express';
import { body, param } from 'express-validator';
import { validate }    from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getCategories,
  getCategoryTree,
  getCategoryChildren,
  getCategoryBreadcrumb,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',                   getCategories);        // flat list
router.get('/tree',               getCategoryTree);      // full nested tree
router.get('/:id/children',       getCategoryChildren);  // direct children
router.get('/:id/breadcrumb',     getCategoryBreadcrumb);// ancestor path

// ── Admin only ────────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate, authorize('admin'),
  [
    body('name').notEmpty().trim(),
    body('parentId').optional().isInt({ min: 1 }),
  ],
  validate,
  createCategory
);

router.put(
  '/:id',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('name').optional().notEmpty().trim(),
    body('parentId').optional().isInt({ min: 1 }),
  ],
  validate,
  updateCategory
);

router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  deleteCategory
);

export default router;