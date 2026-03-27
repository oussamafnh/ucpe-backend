import { Router } from 'express';
import { body }   from 'express-validator';
import { validate } from '../middlewares/validate';
import { requestOtp, verifyOtp, resetPassword } from '../controllers/passwordReset.controller';

const router = Router();

router.post('/request',
  [body('email').isEmail().normalizeEmail().withMessage('Email invalide')],
  validate, requestOtp
);

router.post('/verify',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Code à 6 chiffres requis'),
  ],
  validate, verifyOtp
);

router.post('/reset',
  [
    body('email').isEmail().normalizeEmail(),
    body('newPassword').isLength({ min: 8 }).withMessage('8 caractères minimum'),
  ],
  validate, resetPassword
);

export default router;