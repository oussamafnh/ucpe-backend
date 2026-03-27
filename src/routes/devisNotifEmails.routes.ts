import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  listNotifEmails,
  createNotifEmail,
  updateNotifEmail,
  deleteNotifEmail,
} from '../controllers/devisNotifEmails.controller';

const router = Router();

router.get('/', authenticate, authorize('admin'), listNotifEmails);

router.post('/', authenticate, authorize('admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Adresse email invalide'),
    body('label').optional().trim().escape(),
  ],
  validate, createNotifEmail
);

router.put('/:id', authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('email').optional().isEmail().normalizeEmail().withMessage('Adresse email invalide'),
    body('label').optional().trim().escape(),
    body('active').optional().isBoolean(),
  ],
  validate, updateNotifEmail
);

router.delete('/:id', authenticate, authorize('admin'),
  [param('id').isInt()],
  validate, deleteNotifEmail
);

export default router;