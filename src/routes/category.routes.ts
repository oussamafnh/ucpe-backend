import { Router }      from 'express';
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
  updateCategoryImage,
  deleteCategory,
} from '../controllers/category.controller';

const router = Router();

router.get('/',               getCategories);
router.get('/tree',           getCategoryTree);
router.get('/:id/children',   getCategoryChildren);
router.get('/:id/breadcrumb', getCategoryBreadcrumb);

router.post(
  '/',
  authenticate, authorize('admin'),
  [
    body('name').notEmpty().trim(),
    body('parentId').optional().isInt({ min: 1 }),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  ],
  validate,
  createCategory,
);

router.put(
  '/:id',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('name').optional().notEmpty().trim(),
    body('parentId').optional().isInt({ min: 1 }),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  ],
  validate,
  updateCategory,
);

router.patch(
  '/:id/image',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('image').optional({ nullable: true }),
  ],
  validate,
  updateCategoryImage,
);

router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  deleteCategory,
);

export default router;