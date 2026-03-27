// CodePromo.model.ts

import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface CodePromo extends RowDataPacket {
  id: number;
  code: string;
  value: number;          // percentage 0–100
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  visibilityStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCodePromoDto {
  code: string;
  value: number;
  maxUses?: number | null;
}

export interface UpdateCodePromoDto {
  code?: string;
  value?: number;
  maxUses?: number | null;
  active?: boolean;
  visibilityStatus?: boolean;
}

export const CodePromoModel = {
  async findAll(filters: { active?: boolean; page: number; pageSize: number }): Promise<{ rows: CodePromo[]; total: number }> {
    const conditions: string[] = ['visibilityStatus = 1'];
    const params: unknown[] = [];

    if (filters.active !== undefined) {
      conditions.push('active = ?');
      params.push(filters.active ? 1 : 0);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query<CodePromo[]>(
      `SELECT * FROM codepromo ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
    );
    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM codepromo ${where}`, params
    );
    return { rows: rows.map(parseCodePromo), total };
  },

  async findAllForAdmin(filters: { active?: boolean; page: number; pageSize: number }): Promise<{ rows: CodePromo[]; total: number }> {
    const conditions: string[] = ['visibilityStatus = 1']; // Only show visible codes
    const params: unknown[] = [];

    if (filters.active !== undefined) {
      conditions.push('active = ?');
      params.push(filters.active ? 1 : 0);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query<CodePromo[]>(
      `SELECT * FROM codepromo ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
    );
    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM codepromo ${where}`, params
    );
    return { rows: rows.map(parseCodePromo), total };
  },

  async hide(id: number): Promise<void> {
    await pool.query('UPDATE codepromo SET visibilityStatus = 0, active = 0 WHERE id = ?', [id]);
  },

  async findById(id: number): Promise<CodePromo | null> {
    const [rows] = await pool.query<CodePromo[]>('SELECT * FROM codepromo WHERE id = ?', [id]);
    return rows[0] ? parseCodePromo(rows[0]) : null;
  },

  async findByCode(code: string, includeInactive: boolean = false): Promise<CodePromo | null> {
    let query = 'SELECT * FROM codepromo WHERE code = ?';
    if (!includeInactive) {
      query += ' AND visibilityStatus = 1';
    }
    const [rows] = await pool.query<CodePromo[]>(query, [code.toUpperCase()]);
    return rows[0] ? parseCodePromo(rows[0]) : null;
  },

  async findByCodeForInfo(code: string): Promise<CodePromo | null> {
    // This endpoint returns even inactive/visible codes for informational purposes
    const [rows] = await pool.query<CodePromo[]>(
      'SELECT * FROM codepromo WHERE code = ?',
      [code.toUpperCase()]
    );
    return rows[0] ? parseCodePromo(rows[0]) : null;
  },

  async create(dto: CreateCodePromoDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO codepromo (code, value, maxUses, active, visibilityStatus) VALUES (?, ?, ?, 1, 1)`,
      [dto.code.toUpperCase(), dto.value, dto.maxUses ?? null]
    );
    return result.insertId;
  },

  async update(id: number, dto: UpdateCodePromoDto): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.code !== undefined) { fields.push('code = ?'); values.push(dto.code.toUpperCase()); }
    if (dto.value !== undefined) { fields.push('value = ?'); values.push(dto.value); }
    if (dto.maxUses !== undefined) { fields.push('maxUses = ?'); values.push(dto.maxUses ?? null); }
    if (dto.active !== undefined) { fields.push('active = ?'); values.push(dto.active ? 1 : 0); }
    if (dto.visibilityStatus !== undefined) { fields.push('visibilityStatus = ?'); values.push(dto.visibilityStatus ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);
    await pool.query(`UPDATE codepromo SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async incrementUsed(id: number): Promise<void> {
    await pool.query('UPDATE codepromo SET usedCount = usedCount + 1 WHERE id = ?', [id]);
    // Check if limit is reached after increment
    const [rows] = await pool.query<any[]>('SELECT maxUses, usedCount FROM codepromo WHERE id = ?', [id]);
    if (rows[0] && rows[0].maxUses !== null && rows[0].usedCount >= rows[0].maxUses) {
      await pool.query('UPDATE codepromo SET active = 0 WHERE id = ?', [id]);
    }
  },

  async delete(id: number): Promise<void> {
    await pool.query('UPDATE codepromo SET visibilityStatus = 0, active = 0 WHERE id = ?', [id]);
  },

};

function parseCodePromo(row: any): CodePromo {
  return {
    ...row,
    value: parseFloat(row.value),
    active: Boolean(row.active),
    maxUses: row.maxUses != null ? parseInt(row.maxUses, 10) : null,
    usedCount: parseInt(row.usedCount, 10),
    visibilityStatus: Boolean(row.visibilityStatus),
  };
}