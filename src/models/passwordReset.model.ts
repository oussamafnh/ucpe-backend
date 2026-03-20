import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface PasswordResetRow extends RowDataPacket {
  id:        number;
  email:     string;
  otp:       string;
  expiresAt: Date;
  used:      number;
  createdAt: Date;
}

export const PasswordResetModel = {

  // Delete any existing row for this email, then insert fresh one
  async upsert(email: string, hashedOtp: string, expiresAt: Date): Promise<void> {
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);
    await pool.query<ResultSetHeader>(
      'INSERT INTO password_resets (email, otp, expiresAt) VALUES (?, ?, ?)',
      [email, hashedOtp, expiresAt]
    );
  },

  async findByEmail(email: string): Promise<PasswordResetRow | null> {
    const [rows] = await pool.query<PasswordResetRow[]>(
      'SELECT * FROM password_resets WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async markUsed(email: string): Promise<void> {
    await pool.query('UPDATE password_resets SET used = 1 WHERE email = ?', [email]);
  },

  async deleteByEmail(email: string): Promise<void> {
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);
  },

};