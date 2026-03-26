import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface BlogPost extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  content: string;
  cover_url: string | null;
  cover_filename: string | null;
  tags: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogPostDto {
  slug: string;
  title: string;
  content: string;
  cover_url?: string | null;
  cover_filename?: string | null;
  tags?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  published?: number;
}

export interface UpdateBlogPostDto extends Partial<CreateBlogPostDto> {}

export const BlogModel = {
  async findAll(onlyPublished = false): Promise<BlogPost[]> {
    const where = onlyPublished ? 'WHERE published = 1' : '';
    const [rows] = await pool.query<BlogPost[]>(
      `SELECT * FROM blog_posts ${where} ORDER BY createdAt DESC`
    );
    return rows;
  },

  async findBySlug(slug: string): Promise<BlogPost | null> {
    const [rows] = await pool.query<BlogPost[]>(
      'SELECT * FROM blog_posts WHERE slug = ?',
      [slug]
    );
    return rows[0] || null;
  },

  async findById(id: number): Promise<BlogPost | null> {
    const [rows] = await pool.query<BlogPost[]>(
      'SELECT * FROM blog_posts WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM blog_posts WHERE slug = ? AND id != ?',
      [slug, excludeId ?? 0]
    );
    return rows.length > 0;
  },

  async create(data: CreateBlogPostDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO blog_posts
        (slug, title, content, cover_url, cover_filename, tags, seo_title, seo_description, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.slug,
        data.title,
        data.content,
        data.cover_url ?? null,
        data.cover_filename ?? null,
        data.tags ?? null,
        data.seo_title ?? null,
        data.seo_description ?? null,
        data.published ?? 0,
      ]
    );
    return result.insertId;
  },

  async update(id: number, data: UpdateBlogPostDto): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.cover_url !== undefined) { fields.push('cover_url = ?'); values.push(data.cover_url); }
    if (data.cover_filename !== undefined) { fields.push('cover_filename = ?'); values.push(data.cover_filename); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }
    if (data.seo_title !== undefined) { fields.push('seo_title = ?'); values.push(data.seo_title); }
    if (data.seo_description !== undefined) { fields.push('seo_description = ?'); values.push(data.seo_description); }
    if (data.published !== undefined) { fields.push('published = ?'); values.push(data.published); }

    if (!fields.length) return;

    values.push(id);
    await pool.query(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM blog_posts WHERE id = ?', [id]);
  },
};