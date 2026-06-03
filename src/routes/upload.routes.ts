import { Router }          from 'express';
import { authenticate, authorizeAnyEmployee } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../middlewares/upload';
import { uploadFiles }      from '../controllers/upload.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  authorizeAnyEmployee('products', 'categories', 'inspiration', 'blog'),
  uploadMiddleware,
  uploadFiles
);

export default router;