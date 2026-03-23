import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AccountVerificationRow extends RowDataPacket {
  id:        number;
  email:     string;
  otp:       string;
  expiresAt: Date;
  used:      number;
  createdAt: Date;
}

export const AccountVerificationModel = {
  async upsert(email: string, hashedOtp: string, expiresAt: Date): Promise<void> {
    await pool.query('DELETE FROM account_verifications WHERE email = ?', [email]);
    await pool.query<ResultSetHeader>(
      'INSERT INTO account_verifications (email, otp, expiresAt) VALUES (?, ?, ?)',
      [email, hashedOtp, expiresAt]
    );
  },

  async findByEmail(email: string): Promise<AccountVerificationRow | null> {
    const [rows] = await pool.query<AccountVerificationRow[]>(
      'SELECT * FROM account_verifications WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async markUsed(email: string): Promise<void> {
    await pool.query(
      'UPDATE account_verifications SET used = 1 WHERE email = ?',
      [email]
    );
  },

  async deleteByEmail(email: string): Promise<void> {
    await pool.query('DELETE FROM account_verifications WHERE email = ?', [email]);
  },
};