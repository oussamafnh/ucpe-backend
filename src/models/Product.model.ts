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
  images:          string[];
  variantImages:   string[];
  inStock:         boolean;
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
  images?:          string[];
  inStock?:         boolean;
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
  }): Promise<{ products: any[]; total: number }> {

    const conditions: string[] = ['1=1'];
    const params: unknown[]    = [];

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
    // Price filters applied at SQL level
    if (filters.minPrice !== undefined) {
      conditions.push('p.price >= ?');
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push('p.price <= ?');
      params.push(filters.maxPrice);
    }

    const where = conditions.join(' AND ');

    // ── NON-COLLAPSED (admin) path: pure SQL pagination ──────────────────────
    if (filters.collapseVariants === false) {
      const offset = (filters.page - 1) * filters.pageSize;

      const [[{ total }]] = await pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM products p
         ${categoryJoinSQL()}
         WHERE ${where}`,
        params
      );

      const [rows] = await pool.query<any[]>(
        `${categorySelectSQL()}
         WHERE ${where}
         ORDER BY p.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, filters.pageSize, offset]
      );

      return {
        products: rows.map(r => parseProduct(r, [])),
        total,
      };
    }

    // ── COLLAPSED (public) path ───────────────────────────────────────────────
    //
    // Strategy:
    //   1. For variant products (isInVariant=1): pick ONE representative per
    //      variantId using MIN(id), then LEFT JOIN to get sibling first-images.
    //   2. For standalone products (isInVariant=0): each row is its own item.
    //   3. UNION both sets, order, COUNT and paginate entirely in SQL.
    //
    // This avoids loading all rows into Node.js memory.

    // Build WHERE clause that works for BOTH branches of the UNION.
    // We need two copies of params because UNION uses both sides.

    // ── Step 1: count total collapsed rows ───────────────────────────────────
    const countSQL = `
      SELECT COUNT(*) AS total FROM (
        -- Standalone products
        SELECT p.id
        FROM products p
        ${categoryJoinSQL()}
        WHERE ${where} AND p.isInVariant = 0

        UNION ALL

        -- One representative per variant group
        SELECT MIN(p.id) AS id
        FROM products p
        ${categoryJoinSQL()}
        WHERE ${where} AND p.isInVariant = 1
        GROUP BY p.variantId
      ) AS collapsed
    `;
    // params used twice (once per UNION branch)
    const [[{ total }]] = await pool.query<any[]>(countSQL, [...params, ...params]);

    // ── Step 2: fetch the current page of representative IDs ─────────────────
    const offset = (filters.page - 1) * filters.pageSize;

    const pageIdsSQL = `
      SELECT id FROM (
        -- Standalone products
        SELECT p.id, p.createdAt
        FROM products p
        ${categoryJoinSQL()}
        WHERE ${where} AND p.isInVariant = 0

        UNION ALL

        -- One representative per variant group (earliest id = representative)
        SELECT MIN(p.id) AS id, MIN(p.createdAt) AS createdAt
        FROM products p
        ${categoryJoinSQL()}
        WHERE ${where} AND p.isInVariant = 1
        GROUP BY p.variantId
      ) AS collapsed
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `;
    const [idRows] = await pool.query<any[]>(pageIdsSQL, [
      ...params, ...params, filters.pageSize, offset,
    ]);

    if (idRows.length === 0) return { products: [], total };

    const ids = idRows.map((r: any) => r.id);

    // ── Step 3: fetch full data for those representatives ────────────────────
    const placeholders = ids.map(() => '?').join(',');
    const [repRows] = await pool.query<any[]>(
      `${categorySelectSQL()}
       WHERE p.id IN (${placeholders})
       ORDER BY FIELD(p.id, ${placeholders})`,
      [...ids, ...ids]  // FIELD() needs the list twice
    );

    // ── Step 4: fetch sibling first-images for each variantId ────────────────
    // Only for representatives that are part of a variant group
    const variantIds = repRows
      .filter((r: any) => r.isInVariant && r.variantId)
      .map((r: any) => r.variantId);

    // Map variantId → [firstImage of each sibling except the representative]
    const variantImageMap = new Map<string, string[]>();

    if (variantIds.length > 0) {
      const repIdSet = new Set(repRows.map((r: any) => r.id));
      const vPlaceholders = variantIds.map(() => '?').join(',');

      // Fetch all siblings that are NOT the representative,
      // ordered by id so images are consistent
      const [siblingRows] = await pool.query<any[]>(
        `SELECT variantId, images
         FROM products
         WHERE variantId IN (${vPlaceholders})
           AND id NOT IN (${[...repIdSet].map(() => '?').join(',')})
         ORDER BY variantId, id ASC`,
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

    // ── Step 5: build final product list with variantImages attached ──────────
    const products = repRows.map((row: any) => {
      const siblings = (row.isInVariant && row.variantId)
        ? (variantImageMap.get(row.variantId) ?? [])
        : [];
      return parseProduct(row, siblings);
    });

    return { products, total };
  },

  // ── Single product ──────────────────────────────────────────────────────────

  async findBySlug(slug: string): Promise<any | null> {
    const [rows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.slug = ?`,
      [slug]
    );
    return rows[0] ? parseProduct(rows[0], []) : null;
  },

  async findById(id: number): Promise<any | null> {
    const [rows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.id = ?`,
      [id]
    );
    return rows[0] ? parseProduct(rows[0], []) : null;
  },

  async findVariants(variantId: string): Promise<any[]> {
    const [rows] = await pool.query<any[]>(
      `${categorySelectSQL()} WHERE p.variantId = ? ORDER BY p.title ASC`,
      [variantId]
    );
    return rows.map(r => parseProduct(r, []));
  },

  // ── Variant groups (admin Variants page) ─────────────────────────────────────
  // Returns paginated groups. Each group = { variantId, products[] }.
  // Entirely SQL-driven — no JS-side grouping over all 3000 rows.

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

    // 1. Count distinct variant groups
    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(DISTINCT p.variantId) AS total
       FROM products p
       WHERE p.isInVariant = 1 AND p.variantId IS NOT NULL
       ${searchCondition}`,
      searchParams
    );

    if (total === 0) return { groups: [], total: 0 };

    // 2. Page of variantIds ordered by earliest createdAt in group
    const offset = (filters.page - 1) * filters.pageSize;
    const [variantRows] = await pool.query<any[]>(
      `SELECT p.variantId, MIN(p.createdAt) AS groupCreatedAt
       FROM products p
       WHERE p.isInVariant = 1 AND p.variantId IS NOT NULL
       ${searchCondition}
       GROUP BY p.variantId
       ORDER BY groupCreatedAt DESC
       LIMIT ? OFFSET ?`,
      [...searchParams, filters.pageSize, offset]
    );

    if (variantRows.length === 0) return { groups: [], total };

    const variantIds: string[] = variantRows.map((r: any) => r.variantId);

    // 3. All products for those variantIds in one query
    const placeholders = variantIds.map(() => '?').join(',');
    const [productRows] = await pool.query<any[]>(
      `${categorySelectSQL()}
       WHERE p.variantId IN (${placeholders}) AND p.isInVariant = 1
       ORDER BY p.variantId, p.id ASC`,
      variantIds
    );

    // 4. Reassemble into groups (only over the small page slice)
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

  // ── Write operations ──────────────────────────────────────────────────────

  async create(data: CreateProductDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO products
         (title, slug, reference, description, price, originalPrice, discountPercent,
          images, inStock, categoryId, dimensions, isInVariant, variantId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.slug,
        data.reference       ?? null,
        data.description     ?? null,
        data.price           ?? null,
        data.originalPrice   ?? data.price ?? null,
        data.discountPercent ?? 0,
        JSON.stringify(data.images ?? []),
        data.inStock !== undefined ? data.inStock : true,
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

  if (row.price         != null) row.price         = parseFloat(row.price);
  if (row.originalPrice != null) row.originalPrice = parseFloat(row.originalPrice);

  row.variantImages = variantImages;
  row.category      = buildCategoryTree(row);

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