import { Router }          from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../middlewares/upload';
import { uploadFiles }      from '../controllers/upload.controller';

const router = Router();

router.post('/', authenticate, authorize('admin'), uploadMiddleware, uploadFiles);

export default router;
