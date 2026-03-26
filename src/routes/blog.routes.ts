import { Router } from 'express';
import { param, body } from 'express-validator';
import { validate }                from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { uploadMiddleware }            from '../middlewares/upload';   // see note below
import {
  listPosts, listPostsAdmin, getPost,
  createPost, updatePost, deletePost,
} from '../controllers/blog.controller';

const router = Router();

// Public
router.get('/',       listPosts);
router.get('/admin',  authenticate, authorize('admin'), listPostsAdmin);
router.get('/:slug',  getPost);

// Admin — create
router.post(
  '/',
  authenticate, authorize('admin'),
  uploadMiddleware,          // multer single file field "cover"
  createPost,
);

// Admin — update
router.patch(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  uploadMiddleware,
  updatePost,
);

// Admin — delete
router.delete(
  '/:id',
  authenticate, authorize('admin'),
  [param('id').isInt()], validate,
  deletePost,
);

export default router;