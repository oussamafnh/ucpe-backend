import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorizeEmployee } from '../middlewares/auth.middleware';
import {
  listMessages, getUnreadCount, submitMessage,
  markAsRead, deleteMessage, replyToMessage, getReplies,
} from '../controllers/contact.controller';

const router = Router();

router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('sujet').trim().notEmpty().withMessage('Le sujet est requis'),
    body('message').trim().notEmpty().withMessage('Message trop court'),
  ],
  validate, submitMessage
);

router.get('/', authenticate, authorizeEmployee('contact'), listMessages);
router.get('/unread-count', authenticate, authorizeEmployee('contact'), getUnreadCount);

router.patch('/:id/read', authenticate, authorizeEmployee('contact'),
  [param('id').isInt()], validate, markAsRead
);

router.delete('/:id', authenticate, authorizeEmployee('contact'),
  [param('id').isInt()], validate, deleteMessage
);

router.post('/:id/reply', authenticate, authorizeEmployee('contact'),
  [
    param('id').isInt(),
    body('subject').trim().notEmpty().withMessage('Sujet requis'),
    body('body').trim().isLength({ min: 1 }).withMessage('Message requis'),
  ],
  validate, replyToMessage
);

router.get('/:id/replies', authenticate, authorizeEmployee('contact'),
  [param('id').isInt()], validate, getReplies
);

export default router;