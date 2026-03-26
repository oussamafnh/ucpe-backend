import { Router }    from 'express';
import { body, param, query } from 'express-validator';
import { validate }  from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  listCodePromos,
  getCodePromoById,
  createCodePromo,
  updateCodePromo,
  deleteCodePromo,
  validateCodePromo,
} from '../controllers/codePromo.controller';

const router = Router();

// ── Public — validate a code (no auth required, used in cart) ────────────────
router.get('/validate',
  [query('code').trim().notEmpty().withMessage('Code requis')],
  validate, validateCodePromo
);

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/',
  authenticate, authorize('admin'),
  listCodePromos
);

router.get('/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  getCodePromoById
);

router.post('/',
  authenticate, authorize('admin'),
  [
    body('code').trim().notEmpty().isLength({ max: 20 }).withMessage('Code requis (max 20 car.)'),
    body('value').isFloat({ min: 0.01, max: 100 }).withMessage('Valeur invalide (0.01–100 %)'),
    body('maxUses').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate, createCodePromo
);

router.patch('/:id',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('code').optional().trim().notEmpty().isLength({ max: 20 }),
    body('value').optional().isFloat({ min: 0.01, max: 100 }),
    body('maxUses').optional({ nullable: true }).isInt({ min: 1 }),
    body('active').optional().isBoolean(),
  ],
  validate, updateCodePromo
);

router.delete('/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  deleteCodePromo
);

export default router;