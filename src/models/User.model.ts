import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UserRole } from '../types';

export interface User extends RowDataPacket {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country: string | null;
  address: string | null;
  phone: string | null;
  role: UserRole;
  blocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  country?: string;
  address?: string;
  phone?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  country?: string;
  address?: string;
  phone?: string;
  password?: string;
  blocked?: boolean;
}

export const UserModel = {
  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query<User[]>('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async create(data: CreateUserDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (firstName, lastName, email, password, country, address, phone, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.firstName, data.lastName, data.email, data.password,
        data.country || null, data.address || null, data.phone || null,
        data.role || 'client',
      ]
    );
    return result.insertId;
  },

  async update(id: number, data: UpdateUserDto): Promise<void> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (!entries.length) return;
    const fields = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    await pool.query(`UPDATE users SET ${fields} WHERE id = ?`, [...values, id]);
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  },

  async findAll(
    page: number,
    pageSize: number,
    search = '',
  ): Promise<{ users: User[]; total: number }> {
    const offset = (page - 1) * pageSize;

    if (search) {
      const pattern = `%${search}%`;
      const [users] = await pool.query<User[]>(
        `SELECT * FROM users
         WHERE firstName LIKE ? OR lastName LIKE ? OR email LIKE ?
            OR CONCAT(firstName, ' ', lastName) LIKE ?
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`,
        [pattern, pattern, pattern, pattern, pageSize, offset]
      );
      const [[{ total }]] = await pool.query<any[]>(
        `SELECT COUNT(*) AS total FROM users
         WHERE firstName LIKE ? OR lastName LIKE ? OR email LIKE ?
            OR CONCAT(firstName, ' ', lastName) LIKE ?`,
        [pattern, pattern, pattern, pattern]
      );
      return { users, total };
    }

    const [users] = await pool.query<User[]>(
      'SELECT * FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
    const [[{ total }]] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM users');
    return { users, total };
  },
  // Add to User.model.ts

  async getUsersLast7Days(): Promise<{ date: string; count: number }[]> {
    const [rows] = await pool.query<any[]>(`
    SELECT
      DATE(createdAt) AS date,
      COUNT(*)        AS count
    FROM users
    WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(createdAt)
    ORDER BY date ASC
  `);

    // Fill in missing days with 0
    const result: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const found = rows.find(r => r.date.toISOString?.().slice(0, 10) === key || r.date === key);
      result.push({ date: key, count: found ? Number(found.count) : 0 });
    }
    return result;
  },
};