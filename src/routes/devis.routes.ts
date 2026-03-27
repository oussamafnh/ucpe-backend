import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorize, authorizeEmployee } from '../middlewares/auth.middleware';
import {
  submitDevis, listDevis, getMyDevis, getDevisById,
  updateDevisStatus, replyToDevis, getDevisReplies, deleteDevis,
} from '../controllers/devis.controller';

const router = Router();

router.post('/', authenticate, authorize('client', 'admin'),
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isInt(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('message').optional().isString(),
    body('dateEvenement').optional().isString(),
    body('nombreJours').optional().isInt({ min: 1 }),
    body('delivery').optional().isObject(),
    body('pickup').optional().isObject(),
    body('codePromo').optional().isString().isLength({ max: 20 }),
  ],
  validate, submitDevis
);

router.get('/me', authenticate, authorize('client', 'admin'), getMyDevis);
router.get('/', authenticate, authorizeEmployee('devis'), listDevis);
router.get('/:id', authenticate, authorizeEmployee('devis'), [param('id').isInt()], validate, getDevisById);

router.patch('/:id/status', authenticate, authorizeEmployee('devis'),
  [
    param('id').isInt(),
    body('status').isIn(['pending', 'processing', 'sent', 'rejected']),
    body('adminNote').optional().isString(),
    body('totalFinal').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate, updateDevisStatus
);

router.post('/:id/reply', authenticate, authorizeEmployee('devis'),
  [
    param('id').isInt(),
    body('subject').trim().notEmpty().withMessage('Sujet requis'),
    body('body').trim().notEmpty().withMessage('Message requis'),
    body('totalFinal').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate, replyToDevis
);

router.get('/:id/replies', authenticate, authorizeEmployee('devis'),
  [param('id').isInt()], validate, getDevisReplies
);

router.delete('/:id', authenticate, authorizeEmployee('devis'),
  [param('id').isInt()], validate, deleteDevis
);

export default router;