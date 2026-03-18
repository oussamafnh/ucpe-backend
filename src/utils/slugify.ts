import slugifyLib from 'slugify';
import pool from '../database/connection';

export function makeSlug(text: string): string {
  return slugifyLib(text, { lower: true, strict: true });
}

export async function uniqueSlug(
  base: string,
  table: string,
  excludeId?: number
): Promise<string> {
  let slug = makeSlug(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM ${table} WHERE slug = ? ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (!rows.length) return candidate;
    suffix++;
  }
}
