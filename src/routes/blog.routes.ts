import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorize, authorizeEmployee } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../middlewares/upload';
import {
  listPosts, listPostsAdmin, getPost, createPost, updatePost, deletePost,
} from '../controllers/blog.controller';

const router = Router();

router.get('/', listPosts);
router.get('/admin', authenticate, authorizeEmployee('blog'), listPostsAdmin);
router.get('/:slug', getPost);

router.post('/', authenticate, authorizeEmployee('blog'), uploadMiddleware, createPost);

router.patch('/:id', authenticate, authorizeEmployee('blog'),
  [param('id').isInt()], validate, uploadMiddleware, updatePost
);

router.delete('/:id', authenticate, authorizeEmployee('blog'),
  [param('id').isInt()], validate, deletePost
);

export default router;