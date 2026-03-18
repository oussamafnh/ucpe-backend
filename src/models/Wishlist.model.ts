import pool from '../database/connection';

export const WishlistModel = {

  async getItems(userId: number): Promise<any[]> {
    const [rows] = await pool.query<any[]>(
      `SELECT p.id, p.title, p.slug, p.images, p.price, p.discountPercent, p.inStock
       FROM wishlist_items wi
       JOIN products p ON wi.productId = p.id
       WHERE wi.userId = ?
       ORDER BY wi.addedAt DESC`,
      [userId]
    );
    return rows.map(p => ({
      ...p,
      images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
    }));
  },

  async add(userId: number, productId: number): Promise<void> {
    await pool.query(
      'INSERT IGNORE INTO wishlist_items (userId, productId) VALUES (?, ?)',
      [userId, productId]
    );
  },

  async remove(userId: number, productId: number): Promise<void> {
    await pool.query(
      'DELETE FROM wishlist_items WHERE userId = ? AND productId = ?',
      [userId, productId]
    );
  },

};