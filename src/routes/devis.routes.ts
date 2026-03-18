import { Router }     from 'express';
import { body, param } from 'express-validator';
import { validate }    from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  submitDevis, listDevis, getMyDevis, getDevisById,
  updateDevisStatus, sendDevisEmail, deleteDevis,
} from '../controllers/devis.controller';

const router = Router();

router.post('/',
  authenticate, authorize('client', 'admin'),
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isInt(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('message').optional().isString(),
    body('dateEvenement').optional().isString(),
    body('nombreJours').optional().isInt({ min: 1 }),
    body('delivery').optional().isObject(),
    body('delivery.zone').optional().isIn(['paris', 'oise', 'autre', 'enlevement']),
    body('delivery.date').optional().isString(),
    body('delivery.type').optional().isIn(['ECO', 'PREMIUM']),
    body('pickup').optional().isObject(),
    body('pickup.date').optional().isString(),
    body('pickup.type').optional().isIn(['ECO', 'PREMIUM']),
    body('codePromo').optional().isString().isLength({ max: 20 }),
  ],
  validate, submitDevis
);

router.get('/me', authenticate, authorize('client', 'admin'), getMyDevis);

router.get('/',    authenticate, authorize('admin'), listDevis);
router.get('/:id', authenticate, authorize('admin'), [param('id').isInt()], validate, getDevisById);

router.patch('/:id/status',
  authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('status').isIn(['pending', 'processing', 'sent', 'rejected']),
    body('adminNote').optional().isString(),
    body('totalFinal').optional({ nullable: true }).isFloat({ min: 0 }),  // ← new
  ],
  validate, updateDevisStatus
);

router.post('/:id/send-email',
  authenticate, authorize('admin'),
  [param('id').isInt(), body('subject').notEmpty(), body('message').notEmpty()],
  validate, sendDevisEmail
);

router.delete('/:id', authenticate, authorize('admin'), [param('id').isInt()], validate, deleteDevis);

export default router;