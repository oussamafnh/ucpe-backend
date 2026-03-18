import { Response }      from 'express';
import { WishlistModel } from '../models/Wishlist.model';
import { asyncHandler }  from '../utils/asyncHandler';
import { AuthRequest }   from '../types';

export const getMyWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const products = await WishlistModel.getItems(req.user!.id);
  res.json({ success: true, data: { products } });
});

export const addToWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  await WishlistModel.add(req.user!.id, parseInt(req.body.productId, 10));
  res.json({ success: true, message: 'Added to wishlist' });
});

export const removeFromWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const productId = parseInt(req.params['productId'] as string, 10);
  await WishlistModel.remove(req.user!.id, productId);
  res.json({ success: true, message: 'Removed from wishlist' });
});