import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate }     from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  listEmployees, createEmployee, updateEmployee,
  updateEmployeePermissions, deleteEmployee,
} from '../controllers/employee.controller';

const router = Router();

const VALID_KEYS = [
  'overview', 'users', 'products', 'categories', 'variants',
  'coupons', 'devis', 'contact', 'inspiration', 'blog',
];

router.get('/', authenticate, authorize('admin'), listEmployees);

router.post('/', authenticate, authorize('admin'),
  [
    body('firstName').notEmpty().trim().escape(),
    body('lastName').notEmpty().trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('6 caractères minimum'),
    body('permissions').optional().isArray(),
    body('permissions.*').optional().isIn(VALID_KEYS),
  ],
  validate, createEmployee
);

router.put('/:id', authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('permissions').optional().isArray(),
    body('permissions.*').optional().isIn(VALID_KEYS),
  ],
  validate, updateEmployee
);

router.patch('/:id/permissions', authenticate, authorize('admin'),
  [
    param('id').isInt(),
    body('permissions').isArray(),
    body('permissions.*').isIn(VALID_KEYS),
  ],
  validate, updateEmployeePermissions
);

router.delete('/:id', authenticate, authorize('admin'),
  [param('id').isInt()], validate, deleteEmployee
);

export default router;