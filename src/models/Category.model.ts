import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Category extends RowDataPacket {
  id:        number;
  name:      string;
  slug:      string;
  parentId:  number | null;
  depth:     number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryNode {
  id:       number;
  name:     string;
  slug:     string;
  parentId: number | null;
  depth:    number;
  children: CategoryNode[];
}

export interface CreateCategoryDto {
  name:     string;
  slug:     string;
  parentId?: number | null;
}

// ── Model ─────────────────────────────────────────────────────────────────────

export const CategoryModel = {

  async findAll(): Promise<Category[]> {
    const [rows] = await pool.query<Category[]>(
      'SELECT id, name, slug, parentId, depth FROM categories ORDER BY depth ASC, name ASC'
    );
    return normalizeCategoryNames(rows);
  },

  async findTree(): Promise<CategoryNode[]> {
    const flat = await CategoryModel.findAll();
    return buildTree(flat, null);
  },

  async findById(id: number): Promise<Category | null> {
    const [rows] = await pool.query<Category[]>(
      'SELECT * FROM categories WHERE id = ?', [id]
    );
    const row = rows[0] ?? null;
    return row ? normalizeCategoryNames([row])[0] : null;
  },

  async findBySlug(slug: string): Promise<Category | null> {
    const [rows] = await pool.query<Category[]>(
      'SELECT * FROM categories WHERE slug = ?', [slug]
    );
    const row = rows[0] ?? null;
    return row ? normalizeCategoryNames([row])[0] : null;
  },

  async findChildren(parentId: number): Promise<Category[]> {
    const [rows] = await pool.query<Category[]>(
      'SELECT * FROM categories WHERE parentId = ? ORDER BY name ASC', [parentId]
    );
    return normalizeCategoryNames(rows);
  },

  async findBreadcrumb(id: number): Promise<Category[]> {
    const crumb: Category[] = [];
    let current = await CategoryModel.findById(id);
    while (current) {
      crumb.unshift(current);
      current = current.parentId ? await CategoryModel.findById(current.parentId) : null;
    }
    return crumb;
  },

  async create(dto: CreateCategoryDto): Promise<number> {
    let depth = 0;
    if (dto.parentId) {
      const parent = await CategoryModel.findById(dto.parentId);
      depth = parent ? parent.depth + 1 : 0;
    }
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO categories (name, slug, parentId, depth) VALUES (?, ?, ?, ?)',
      [dto.name, dto.slug, dto.parentId ?? null, depth]
    );
    return result.insertId;
  },

  async update(id: number, dto: Partial<CreateCategoryDto>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.name     !== undefined) { fields.push('name = ?');     values.push(dto.name); }
    if (dto.slug     !== undefined) { fields.push('slug = ?');     values.push(dto.slug); }
    if (dto.parentId !== undefined) {
      fields.push('parentId = ?');
      values.push(dto.parentId ?? null);
      let depth = 0;
      if (dto.parentId) {
        const parent = await CategoryModel.findById(dto.parentId);
        depth = parent ? parent.depth + 1 : 0;
      }
      fields.push('depth = ?');
      values.push(depth);
    }

    if (!fields.length) return;
    values.push(id);
    await pool.query(
      `UPDATE categories SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
      values
    );
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(flat: Category[], parentId: number | null): CategoryNode[] {
  return flat
    .filter(c => c.parentId === parentId)
    .map(c => ({
      id:       c.id,
      name:     c.name,
      slug:     c.slug,
      parentId: c.parentId,
      depth:    c.depth,
      children: buildTree(flat, c.id),
    }));
}

function titleCase(str: string): string {
  if (!str) return str;
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeCategoryNames(categories: Category[]): Category[] {
  return categories.map(c => ({
    ...c,
    name: c.depth === 0 ? titleCase(c.name) : c.name,
  }));
}