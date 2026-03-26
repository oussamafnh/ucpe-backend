import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface CodePromo extends RowDataPacket {
  id: number;
  code: string;
  value: number;          // percentage 0–100
  maxUses: number | null;
  usedCount: number;
  active: boolean;
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
}

export const CodePromoModel = {
  async findAll(filters: { active?: boolean; page: number; pageSize: number }): Promise<{ rows: CodePromo[]; total: number }> {
    const cond = filters.active !== undefined ? 'WHERE active = ?' : '';
    const params: unknown[] = filters.active !== undefined ? [filters.active ? 1 : 0] : [];
    const [rows] = await pool.query<CodePromo[]>(
      `SELECT * FROM codepromo ${cond} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
    );
    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM codepromo ${cond}`, params
    );
    return { rows: rows.map(parseCodePromo), total };
  },

  async findById(id: number): Promise<CodePromo | null> {
    const [rows] = await pool.query<CodePromo[]>('SELECT * FROM codepromo WHERE id = ?', [id]);
    return rows[0] ? parseCodePromo(rows[0]) : null;
  },

  async findByCode(code: string): Promise<CodePromo | null> {
    const [rows] = await pool.query<CodePromo[]>(
      'SELECT * FROM codepromo WHERE code = ?', [code.toUpperCase()]
    );
    return rows[0] ? parseCodePromo(rows[0]) : null;
  },

  async create(dto: CreateCodePromoDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO codepromo (code, value, maxUses) VALUES (?, ?, ?)`,
      [dto.code.toUpperCase(), dto.value, dto.maxUses ?? null]
    );
    return result.insertId;
  },

  async update(id: number, dto: UpdateCodePromoDto): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.code    !== undefined) { fields.push('code = ?');    values.push(dto.code.toUpperCase()); }
    if (dto.value   !== undefined) { fields.push('value = ?');   values.push(dto.value); }
    if (dto.maxUses !== undefined) { fields.push('maxUses = ?'); values.push(dto.maxUses ?? null); }
    if (dto.active  !== undefined) { fields.push('active = ?');  values.push(dto.active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);
    await pool.query(`UPDATE codepromo SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async incrementUsed(id: number): Promise<void> {
    await pool.query('UPDATE codepromo SET usedCount = usedCount + 1 WHERE id = ?', [id]);
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM codepromo WHERE id = ?', [id]);
  },
};

function parseCodePromo(row: any): CodePromo {
  return {
    ...row,
    value:     parseFloat(row.value),
    active:    Boolean(row.active),
    maxUses:   row.maxUses != null ? parseInt(row.maxUses, 10) : null,
    usedCount: parseInt(row.usedCount, 10),
  };
}