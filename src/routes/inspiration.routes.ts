import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorizeEmployee } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../middlewares/upload';
import {
  listInspirations, addInspirations, deleteInspiration,
} from '../controllers/inspiration.controller';

const router = Router();

router.get('/', listInspirations);

router.post('/', authenticate, authorizeEmployee('inspiration'), uploadMiddleware, addInspirations);

router.delete('/:id', authenticate, authorizeEmployee('inspiration'),
  [param('id').isInt()], validate, deleteInspiration
);

export default router;