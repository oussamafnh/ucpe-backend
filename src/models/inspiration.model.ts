import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Inspiration extends RowDataPacket {
  id:        number;
  url:       string;
  filename:  string;
  alt:       string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInspirationDto {
  url:      string;
  filename: string;
  alt?:     string | null;
}

export const InspirationModel = {

  async findAll(): Promise<Inspiration[]> {
    const [rows] = await pool.query<Inspiration[]>(
      'SELECT * FROM inspirations ORDER BY createdAt DESC'
    );
    return rows;
  },

  async findById(id: number): Promise<Inspiration | null> {
    const [rows] = await pool.query<Inspiration[]>(
      'SELECT * FROM inspirations WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async create(data: CreateInspirationDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO inspirations (url, filename, alt) VALUES (?, ?, ?)',
      [data.url, data.filename, data.alt ?? null]
    );
    return result.insertId;
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM inspirations WHERE id = ?', [id]);
  },

};
