import { Request, Response } from 'express';
import { CategoryModel }     from '../models/Category.model';
import { AppError }          from '../utils/AppError';
import { asyncHandler }      from '../utils/asyncHandler';
import { uniqueSlug }        from '../utils/slugify';

/** GET /categories  — flat list */
export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await CategoryModel.findAll();
  res.json({ success: true, data });
});

/** GET /categories/tree  — nested tree */
export const getCategoryTree = asyncHandler(async (_req: Request, res: Response) => {
  const data = await CategoryModel.findTree();
  res.json({ success: true, data });
});

/** GET /categories/:id/children  — direct children */
export const getCategoryChildren = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const data = await CategoryModel.findChildren(id);
  res.json({ success: true, data });
});

/** GET /categories/:id/breadcrumb  — ancestor chain */
export const getCategoryBreadcrumb = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const data = await CategoryModel.findBreadcrumb(id);
  res.json({ success: true, data });
});

/** POST /categories */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, slug: rawSlug, parentId } = req.body;
  const slug = rawSlug ?? await uniqueSlug(name, 'categories');

  const exists = await CategoryModel.findBySlug(slug);
  if (exists) throw new AppError('Slug already taken', 409);

  const id = await CategoryModel.create({ name, slug, parentId: parentId ?? null });
  res.status(201).json({ success: true, data: await CategoryModel.findById(id) });
});

/** PUT /categories/:id */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const id                        = parseInt(req.params.id as string, 10);
  const { name, slug: rawSlug, parentId } = req.body;
  const slug = rawSlug ?? (name ? await uniqueSlug(name, 'categories', id) : undefined);

  await CategoryModel.update(id, { name, slug, parentId });
  res.json({ success: true, data: await CategoryModel.findById(id) });
});

/** DELETE /categories/:id */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await CategoryModel.delete(parseInt(req.params.id as string, 10));
  res.json({ success: true, message: 'Category deleted. Children parentId set to NULL.' });
});