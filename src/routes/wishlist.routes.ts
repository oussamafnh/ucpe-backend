import { Router } from 'express';
import { body }    from 'express-validator';
import { validate } from '../middlewares/validate';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller';

const router = Router();

const auth = [authenticate, authorize('client', 'admin')];

router.get   ('/me',                     ...auth, getMyWishlist);
router.post  ('/me/add',                 ...auth, [body('productId').isInt()], validate, addToWishlist);
router.delete('/me/remove/:productId',   ...auth, removeFromWishlist);

export default router;