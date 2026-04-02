import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorize, authorizeEmployee } from '../middlewares/auth.middleware';
import {
  getProducts, getProductBySlug, getProductVariants, getProductStats,
  getVariantGroups, createProduct, updateProduct, deleteProduct,
  toggleStock, toggleHidden, setDiscount, setVariant,
} from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.get('/stats', authenticate, authorizeEmployee('products'), getProductStats);
router.get('/variant-groups', authenticate, authorizeEmployee('variants'), getVariantGroups);
router.get('/:slug', getProductBySlug);
router.get('/:slug/variants', getProductVariants);

router.post('/', authenticate, authorizeEmployee('products'), createProduct);

router.put('/:id', authenticate, authorizeEmployee('products'),
  [param('id').isInt()], validate, updateProduct
);

router.patch('/:id', authenticate, authorizeEmployee('products'),
  [param('id').isInt()], validate, updateProduct
);

router.patch('/:id/stock', authenticate, authorizeEmployee('products'),
  [param('id').isInt(), body('inStock').isBoolean()], validate, toggleStock
);

router.patch('/:id/hidden', authenticate, authorizeEmployee('products'),
  [param('id').isInt(), body('isHidden').isBoolean()], validate, toggleHidden
);

router.patch('/:id/discount', authenticate, authorizeEmployee('products'),
  [param('id').isInt()], validate, setDiscount
);

router.patch('/:id/variant', authenticate, authorizeEmployee('variants'),
  [param('id').isInt()], validate, setVariant
);

router.delete('/:id', authenticate, authorizeEmployee('products'),
  [param('id').isInt()], validate, deleteProduct
);

export default router;