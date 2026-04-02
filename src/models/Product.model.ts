import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Product extends RowDataPacket {
  id:              number;
  title:           string;
  slug:            string;
  reference:       string | null;
  description:     string | null;
  price:           number | null;
  originalPrice:   number | null;
  discountPercent: number;
  discountEuro:    number | null;
  images:          string[];
  variantImages:   string[];
  inStock:         boolean;
  isForSell:       boolean;
  isHidden:        boolean;
  ficheTechnique:  string | null;
  categoryId:      number | null;
  dimensions:      Record<string, unknown> | null;
  isInVariant:     boolean;
  variantId:       string | null;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface CreateProductDto {
  title:            string;
  slug:             string;
  reference?:       string;
  description?:     string;
  price?:           number;
  originalPrice?:   number;
  discountPercent?: number;
  discountEuro?:    number | null;
  images?:          string[];
  inStock?:         boolean;
  isForSell?:       boolean;
  isHidden?:        boolean;
  ficheTechnique?:  string | null;
  categoryId?:      number;
  dimensions?:      Record<string, unknown>;
  isInVariant?:     boolean;
  variantId?:       string | null;
}

// ── Model ─────────────────────────────────────────────────────────────────────

export const ProductModel = {

  async findAll(filters: {
    categorySlug?:     string;
    inStock?:          boolean;
    isInVariant?:      boolean;
    variantId?:        string;
    search?:           string;
    minPrice?:         number;
    maxPrice?:         number;
    page:              number;
    pageSize:          number;
    collapseVariants?: boolean;
    showHidden?:       boolean;
  }): Promise<{ products: any[]; total: number }> {

    const conditions: string[] = ['1=1'];
    const params: unknown[]    = [];

    // ── Hide from public by default ──────────────────────────────────────────
    if (!filters.showHidden) {
      conditions.push('p.isHidden = 0');
    }

    if (filters.categorySlug) {
      conditions.push(`(leaf.slug = ? OR sub.slug = ? OR cat.slug = ?)`);
      params.push(filters.categorySlug, filters.categorySlug, filters.categorySlug);
    }
    if (filters.inStock !== undefined) {
      conditions.push('p.inStock = ?');
      params.push(filters.inStock ? 1 : 0);
    }
    if (filters.isInVariant !== undefined) {
      conditions.push('p.isInVariant = ?');
      params.push(filters.isInVariant ? 1 : 0);
    }
    if (filters.variantId) {
      conditions.push('p.variantId = ?');
      params.push(filters.variantId);
    }
    if (filters.search?.trim()) {
      conditions.push('(p.title LIKE ? OR p.reference LIKE ?)');
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }
    if (filters.minPrice !== undefined) {
      conditions.push('p.price >= ?');
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push('p.price <= ?');
      params.push(filters.maxPrice);
    }

    const where = conditions.join(' AND ');

    if (filters.collapseVariants === false) {
      const offset = (filters.page - 1) * filters.pageSize;

      const [[{ total }]] = await pool.query<any[]>(
        `SELECT COUNT(*) AS total FROM products p ${categoryJoinSQL()} WHERE ${where}`,
        params
      );

      const [rows] = await pool.query<any[]>(
        `${categorySelectSQL()} WHERE ${where} ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, filters.pageSize, offset]
      );

      return { products: rows.map(r => parseProduct(r, [])), total };
    }

    const countSQL = `
      SELECT COUNT(*) AS total FROM (
        SELECT p.id FROM products p ${categoryJoinSQL()} WHERE ${where} AND p.isInVariant = 0
        UNION ALL
        SELECT MIN(p.id) AS id FROM products p ${categoryJoinSQL()} WHERE ${where} AND p.isInVariant = 1 GROUP BY p.variantId
      ) AS collapsed
    `;
    const [[{ total }]] = await pool.query<any[]>(countSQL, [...params, ...params]);

    const offset = (filters.page - 1) * filters.pageSize;

    const pageIdsSQL = `
      SELECT id FROM (
        SELECT p.id, p.createdAt FROM products p ${categoryJoinSQL()} WHERE ${where} AND p.isInVariant = 0
        UNION ALL
        SELECT MIN(p.id) AS id, MIN(p.createdAt) AS createdAt FROM products p ${categoryJoinSQL()} WHERE ${where} AND p.isInVariant = 1 GROUP BY p.variantId
      ) AS collapsed ORDER BY createdAt DESC LIMIT ? OFFSET ?
    `;
    const [idRows] = await pool.query<any[]>(pageIdsSQL, [...params, ...params, filters.pageSize, offset]);

    if (idRows.length === 0) return { products: [], total };

    const ids = idRows.map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [repRows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.id IN (${placeholders}) ORDER BY FIELD(p.id, ${placeholders})`,
      [...ids, ...ids]
    );

    const variantIds = repRows
      .filter((r: any) => r.isInVariant && r.variantId)
      .map((r: any) => r.variantId);

    const variantImageMap = new Map<string, string[]>();

    if (variantIds.length > 0) {
      const repIdSet = new Set(repRows.map((r: any) => r.id));
      const vPlaceholders = variantIds.map(() => '?').join(',');

      const [siblingRows] = await pool.query<any[]>(
        `SELECT variantId, images FROM products WHERE variantId IN (${vPlaceholders}) AND id NOT IN (${[...repIdSet].map(() => '?').join(',')}) ORDER BY variantId, id ASC`,
        [...variantIds, ...repIdSet]
      );

      for (const row of siblingRows) {
        if (!row.variantId) continue;
        let imgs: string[] = [];
        try { imgs = typeof row.images === 'string' ? JSON.parse(row.images) : row.images ?? []; } catch {}
        const firstImg = imgs[0];
        if (!firstImg) continue;
        if (!variantImageMap.has(row.variantId)) variantImageMap.set(row.variantId, []);
        variantImageMap.get(row.variantId)!.push(firstImg);
      }
    }

    const products = repRows.map((row: any) => {
      const siblings = (row.isInVariant && row.variantId)
        ? (variantImageMap.get(row.variantId) ?? [])
        : [];
      return parseProduct(row, siblings);
    });

    return { products, total };
  },

  async findBySlug(slug: string): Promise<any | null> {
    const [rows] = await pool.query<any[]>(`${categorySelectSQL()} WHERE p.slug = ?`, [slug]);
    return rows[0] ? parseProduct(rows[0], []) : null;
  },

  async findById(id: number): Promise<any | null> {
    const [rows] = await pool.query<any[]>(`${categorySelectSQL()} WHERE p.id = ?`, [id]);
    return rows[0] ? parseProduct(rows[0], []) : null;
  },

  async findVariants(variantId: string): Promise<any[]> {
    const [rows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.variantId = ? ORDER BY p.title ASC`,
      [variantId]
    );
    return rows.map(r => parseProduct(r, []));
  },

  async findVariantGroups(filters: {
    search?:  string;
    page:     number;
    pageSize: number;
  }): Promise<{ groups: { variantId: string; products: any[] }[]; total: number }> {

    const searchCondition = filters.search?.trim()
      ? `AND (p.title LIKE ? OR p.reference LIKE ?)`
      : '';
    const searchParams = filters.search?.trim()
      ? [`%${filters.search.trim()}%`, `%${filters.search.trim()}%`]
      : [];

    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(DISTINCT p.variantId) AS total FROM products p WHERE p.isInVariant = 1 AND p.variantId IS NOT NULL ${searchCondition}`,
      searchParams
    );

    if (total === 0) return { groups: [], total: 0 };

    const offset = (filters.page - 1) * filters.pageSize;
    const [variantRows] = await pool.query<any[]>(
      `SELECT p.variantId, MIN(p.createdAt) AS groupCreatedAt FROM products p WHERE p.isInVariant = 1 AND p.variantId IS NOT NULL ${searchCondition} GROUP BY p.variantId ORDER BY groupCreatedAt DESC LIMIT ? OFFSET ?`,
      [...searchParams, filters.pageSize, offset]
    );

    if (variantRows.length === 0) return { groups: [], total };

    const variantIds: string[] = variantRows.map((r: any) => r.variantId);
    const placeholders = variantIds.map(() => '?').join(',');
    const [productRows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.variantId IN (${placeholders}) AND p.isInVariant = 1 ORDER BY p.variantId, p.id ASC`,
      variantIds
    );

    const groupMap = new Map<string, any[]>();
    for (const vid of variantIds) groupMap.set(vid, []);
    for (const row of productRows) {
      const parsed = parseProduct(row, []);
      groupMap.get(parsed.variantId)?.push(parsed);
    }

    return {
      groups: variantIds.map(vid => ({ variantId: vid, products: groupMap.get(vid) ?? [] })),
      total,
    };
  },

  async create(data: CreateProductDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO products
         (title, slug, reference, description, price, originalPrice, discountPercent, discountEuro,
          images, inStock, isForSell, isHidden, ficheTechnique, categoryId, dimensions, isInVariant, variantId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.slug,
        data.reference       ?? null,
        data.description     ?? null,
        data.price           ?? null,
        data.originalPrice   ?? data.price ?? null,
        data.discountPercent ?? 0,
        data.discountEuro    ?? null,
        JSON.stringify(data.images ?? []),
        data.inStock !== undefined ? (data.inStock ? 1 : 0) : 1,
        data.isForSell !== undefined ? (data.isForSell ? 1 : 0) : 1,
        data.isHidden ? 1 : 0,
        data.ficheTechnique  ?? null,
        data.categoryId      ?? null,
        data.dimensions      ? JSON.stringify(data.dimensions) : null,
        data.isInVariant     ? 1 : 0,
        data.variantId       ?? null,
      ]
    );
    return result.insertId;
  },

  async update(id: number, data: Partial<CreateProductDto>): Promise<void> {
    const map: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) map[k] = v;
    }
    if (map.images      !== undefined) map.images      = JSON.stringify(map.images);
    if (map.dimensions  !== undefined) map.dimensions  = JSON.stringify(map.dimensions);
    if (map.isInVariant !== undefined) map.isInVariant = map.isInVariant ? 1 : 0;
    if (map.isForSell   !== undefined) map.isForSell   = map.isForSell   ? 1 : 0;
    if (map.inStock     !== undefined) map.inStock     = map.inStock     ? 1 : 0;
    if (map.isHidden    !== undefined) map.isHidden    = map.isHidden    ? 1 : 0;

    const keys   = Object.keys(map);
    const fields = keys.map(k => `\`${k}\` = ?`);
    const values = keys.map(k => map[k]);
    if (!fields.length) return;

    await pool.query(
      `UPDATE products SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
      [...values, id]
    );
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
  },
};

// ── SQL helpers ───────────────────────────────────────────────────────────────

function categoryJoinSQL(): string {
  return `
    LEFT JOIN categories leaf ON p.categoryId = leaf.id
    LEFT JOIN categories sub  ON leaf.parentId = sub.id
    LEFT JOIN categories cat  ON sub.parentId  = cat.id
  `;
}

function categorySelectSQL(): string {
  return `
    SELECT
      p.*,
      leaf.id    AS subsubcatId,
      leaf.name  AS subsubcatName,
      leaf.slug  AS subsubcatSlug,
      sub.id     AS subcatId,
      sub.name   AS subcatName,
      sub.slug   AS subcatSlug,
      cat.id     AS catId,
      cat.name   AS catName,
      cat.slug   AS catSlug
    FROM products p
    ${categoryJoinSQL()}
  `;
}

// ── Row parser ────────────────────────────────────────────────────────────────

function parseProduct(row: any, variantImages: string[]) {
  if (typeof row.images     === 'string') row.images     = JSON.parse(row.images);
  if (typeof row.dimensions === 'string') try { row.dimensions = JSON.parse(row.dimensions); } catch {}

  row.inStock     = Boolean(row.inStock);
  row.isInVariant = Boolean(row.isInVariant);
  row.isForSell   = row.isForSell !== undefined ? Boolean(row.isForSell) : true;
  row.isHidden    = Boolean(row.isHidden);

  if (row.price         != null) row.price         = parseFloat(row.price);
  if (row.originalPrice != null) row.originalPrice = parseFloat(row.originalPrice);
  if (row.discountEuro  != null) row.discountEuro  = parseFloat(row.discountEuro);
  if (row.discountPercent != null) row.discountPercent = parseInt(row.discountPercent, 10);

  row.variantImages  = variantImages;
  row.category       = buildCategoryTree(row);
  row.ficheTechnique = row.ficheTechnique ?? null;

  for (const k of ['catId','catName','catSlug','subcatId','subcatName','subcatSlug',
                    'subsubcatId','subsubcatName','subsubcatSlug']) {
    delete row[k];
  }

  return row;
}

function buildCategoryTree(row: any): object | null {
  if (!row.catId && !row.subcatId && !row.subsubcatId) return null;

  if (row.catId) {
    return {
      id: row.catId, name: row.catName, slug: row.catSlug,
      sub: row.subcatId ? {
        id: row.subcatId, name: row.subcatName, slug: row.subcatSlug,
        sub: row.subsubcatId ? {
          id: row.subsubcatId, name: row.subsubcatName, slug: row.subsubcatSlug, sub: null,
        } : null,
      } : null,
    };
  }

  if (row.subcatId) {
    return {
      id: row.subcatId, name: row.subcatName, slug: row.subcatSlug,
      sub: row.subsubcatId ? {
        id: row.subsubcatId, name: row.subsubcatName, slug: row.subsubcatSlug, sub: null,
      } : null,
    };
  }

  return { id: row.subsubcatId, name: row.subsubcatName, slug: row.subsubcatSlug, sub: null };
}