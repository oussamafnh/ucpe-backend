import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { BlogModel } from '../models/blog.model';
import fs from 'fs';
import path from 'path';

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const listPosts = asyncHandler(async (_req: Request, res: Response) => {
  const items = await BlogModel.findAll(true);
  res.json({ success: true, data: items });
});

export const listPostsAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const items = await BlogModel.findAll(false);
  res.json({ success: true, data: items });
});

export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;
  const post = await BlogModel.findBySlug(slug);

  if (!post || (!post.published && (req as any).user?.role !== 'admin')) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  res.json({ success: true, data: post });
});

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, tags, seo_title, seo_description, published } = req.body;

  if (!title || !content) {
    res.status(400).json({ success: false, message: 'title and content are required' });
    return;
  }

  let slug = req.body.slug ? toSlug(req.body.slug) : toSlug(title);
  if (await BlogModel.slugExists(slug)) slug = `${slug}-${Date.now()}`;

  const files = req.files as Express.Multer.File[] | undefined;
  const file = files?.[0];

  const id = await BlogModel.create({
    slug,
    title,
    content,
    cover_url: file ? `/uploads/${file.filename}` : null,
    cover_filename: file ? file.filename : null,
    tags: tags || null,
    seo_title: seo_title || null,
    seo_description: seo_description || null,
    published: published === 'true' || published === true || published === 1 ? 1 : 0,
  });

  const post = await BlogModel.findById(id);
  res.status(201).json({ success: true, data: post });
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const existing = await BlogModel.findById(id);

  if (!existing) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const { title, content, tags, seo_title, seo_description, published } = req.body;
  const files = req.files as Express.Multer.File[] | undefined;
  const file = files?.[0];

  let slugUpdate: string | undefined;

  if (req.body.slug) {
    slugUpdate = toSlug(req.body.slug);
    if (await BlogModel.slugExists(slugUpdate, id)) slugUpdate = `${slugUpdate}-${Date.now()}`;
  } else if (title && title !== existing.title) {
    slugUpdate = toSlug(title);
    if (await BlogModel.slugExists(slugUpdate, id)) slugUpdate = `${slugUpdate}-${Date.now()}`;
  }

  if (file && existing.cover_filename) {
    const old = path.join(__dirname, '../../public/uploads', existing.cover_filename);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  await BlogModel.update(id, {
    ...(slugUpdate !== undefined && { slug: slugUpdate }),
    ...(title !== undefined && { title }),
    ...(content !== undefined && { content }),
    ...(file && { cover_url: `/uploads/${file.filename}`, cover_filename: file.filename }),
    ...(tags !== undefined && { tags: tags || null }),
    ...(seo_title !== undefined && { seo_title: seo_title || null }),
    ...(seo_description !== undefined && { seo_description: seo_description || null }),
    ...(published !== undefined && {
      published: published === 'true' || published === true || published === 1 ? 1 : 0,
    }),
  });

  const post = await BlogModel.findById(id);
  res.json({ success: true, data: post });
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const post = await BlogModel.findById(id);

  if (!post) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  if (post.cover_filename) {
    const fp = path.join(__dirname, '../../public/uploads', post.cover_filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  await BlogModel.delete(id);
  res.json({ success: true, message: 'Deleted' });
});