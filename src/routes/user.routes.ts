import { Router }      from 'express';
import { body, param }  from 'express-validator';
import { validate }     from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getMe, updateMe, deleteMe, listUsers, getUserById, updateUser, deleteUser , getUsersStats
} from '../controllers/user.controller';

const router = Router();

// ── Authenticated user ────────────────────────────────────────────────────────
router.get('/me',    authenticate, getMe);
router.put('/me',    authenticate,
  [
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('country').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('phone').optional().trim().escape(),
    body('currentPassword').optional().isString(),
    body('newPassword').optional().isLength({ min: 8 })
      .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.'),
  ],
  validate,
  updateMe
);
router.delete('/me', authenticate, deleteMe);

// ── Admin only ────────────────────────────────────────────────────────────────
router.get('/',    authenticate, authorize('admin'), listUsers);

router.get('/:id', authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  getUserById
);

router.put('/:id', authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('blocked').optional().isBoolean(),
    body('role').optional().isIn(['admin', 'client']),
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('country').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('phone').optional().trim().escape(),
  ],
  validate,
  updateUser
);

router.delete('/:id', authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  deleteUser
);


router.get('/stats/new', authenticate, authorize('admin'), getUsersStats);
 

export default router;