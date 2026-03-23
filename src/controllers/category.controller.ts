import { Request, Response } from 'express';
import { CategoryModel }     from '../models/Category.model';
import { AppError }          from '../utils/AppError';
import { asyncHandler }      from '../utils/asyncHandler';
import { uniqueSlug }        from '../utils/slugify';

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await CategoryModel.findAll();
  res.json({ success: true, data });
});

export const getCategoryTree = asyncHandler(async (_req: Request, res: Response) => {
  const data = await CategoryModel.findTree();
  res.json({ success: true, data });
});

export const getCategoryChildren = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const data = await CategoryModel.findChildren(id);
  res.json({ success: true, data });
});

export const getCategoryBreadcrumb = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const data = await CategoryModel.findBreadcrumb(id);
  res.json({ success: true, data });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, slug: rawSlug, parentId, description } = req.body;
  const slug = rawSlug ?? await uniqueSlug(name, 'categories');

  const exists = await CategoryModel.findBySlug(slug);
  if (exists) throw new AppError('Slug already taken', 409);

  const id = await CategoryModel.create({ name, slug, parentId: parentId ?? null, description: description ?? null });
  res.status(201).json({ success: true, data: await CategoryModel.findById(id) });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const id                                          = parseInt(req.params.id as string, 10);
  const { name, slug: rawSlug, parentId, description } = req.body;
  const slug = rawSlug ?? (name ? await uniqueSlug(name, 'categories', id) : undefined);

  await CategoryModel.update(id, { name, slug, parentId, description });
  res.json({ success: true, data: await CategoryModel.findById(id) });
});

export const updateCategoryImage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);

  const category = await CategoryModel.findById(id);
  if (!category)            throw new AppError('Category not found', 404);
  if (category.depth !== 0) throw new AppError('Images are only allowed on root categories', 400);

  const { image } = req.body as { image: string | null };
  await CategoryModel.updateImage(id, image ?? null);

  res.json({ success: true, data: await CategoryModel.findById(id) });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await CategoryModel.delete(parseInt(req.params.id as string, 10));
  res.json({ success: true, message: 'Category deleted.' });
});