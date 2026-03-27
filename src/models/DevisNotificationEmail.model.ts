import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface DevisNotificationEmail extends RowDataPacket {
  id: number;
  email: string;
  label: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DevisNotificationEmailModel = {
  async findAll(): Promise<DevisNotificationEmail[]> {
    const [rows] = await pool.query<DevisNotificationEmail[]>(
      'SELECT * FROM devis_notification_emails ORDER BY createdAt DESC'
    );
    return rows;
  },

  async findActive(): Promise<string[]> {
    const [rows] = await pool.query<DevisNotificationEmail[]>(
      'SELECT email FROM devis_notification_emails WHERE active = 1'
    );
    return rows.map(r => r.email);
  },

  async create(email: string, label?: string): Promise<DevisNotificationEmail> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO devis_notification_emails (email, label) VALUES (?, ?)',
      [email.trim().toLowerCase(), label?.trim() || null]
    );
    const [rows] = await pool.query<DevisNotificationEmail[]>(
      'SELECT * FROM devis_notification_emails WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  },

  async update(id: number, data: { email?: string; label?: string; active?: boolean }): Promise<DevisNotificationEmail | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email.trim().toLowerCase()); }
    if (data.label !== undefined) { fields.push('label = ?'); values.push(data.label.trim() || null); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (!fields.length) return this.findById(id);
    values.push(id);
    await pool.query(`UPDATE devis_notification_emails SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  async findById(id: number): Promise<DevisNotificationEmail | null> {
    const [rows] = await pool.query<DevisNotificationEmail[]>(
      'SELECT * FROM devis_notification_emails WHERE id = ?', [id]
    );
    return rows[0] ?? null;
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM devis_notification_emails WHERE id = ?', [id]);
  },
};