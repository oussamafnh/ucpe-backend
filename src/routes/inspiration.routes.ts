import { Router } from 'express';
import { param }   from 'express-validator';
import { validate }                        from '../middlewares/validate';
import { authenticate, authorize }         from '../middlewares/auth.middleware';
import { uploadMiddleware }                 from '../middlewares/upload';
import {
  listInspirations,
  addInspirations,
  deleteInspiration,
} from '../controllers/inspiration.controller';

const router = Router();

// Public — guests and clients can browse the gallery
router.get('/', listInspirations);

// Admin only — upload one or more images at once
router.post(
  '/',
  authenticate, authorize('admin'),
  uploadMiddleware,
  addInspirations
);

// Admin only — delete a single image by id
router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()],
  validate,
  deleteInspiration
);

export default router;