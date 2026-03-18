import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate }    from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  listMessages,
  getUnreadCount,
  submitMessage,
  markAsRead,
  deleteMessage,
} from '../controllers/contact.controller';

const router = Router();

// Public — anyone can submit a message
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('sujet').trim().notEmpty().withMessage('Le sujet est requis'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message trop court'),
  ],
  validate,
  submitMessage
);

// Admin only
router.get('/',             authenticate, authorize('admin'), listMessages);
router.get('/unread-count', authenticate, authorize('admin'), getUnreadCount);

router.patch(
  '/:id/read',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  markAsRead
);

router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  deleteMessage
);

export default router;
