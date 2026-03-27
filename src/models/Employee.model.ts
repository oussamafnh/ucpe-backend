import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UserModel, User } from './User.model';

export interface EmployeePermission extends RowDataPacket {
  id:       number;
  userId:   number;
  pageKey:  string;
  canWrite: boolean;
}

export interface EmployeeWithPermissions extends User {
  permissions: string[];
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
}

export const EmployeeModel = {
  async create(data: CreateEmployeeDto): Promise<number> {
    return UserModel.create({ ...data, role: 'employee', isActivated: true });
  },

  async findAll(): Promise<EmployeeWithPermissions[]> {
    const [users] = await pool.query<User[]>(
      `SELECT * FROM users WHERE role = 'employee' ORDER BY createdAt DESC`
    );
    if (!users.length) return [];

    const ids = users.map(u => u.id);
    const [perms] = await pool.query<EmployeePermission[]>(
      `SELECT * FROM employee_permissions WHERE userId IN (?)`,
      [ids]
    );

    return users.map(u => ({
      ...u,
      permissions: perms.filter(p => p.userId === u.id).map(p => p.pageKey),
    }));
  },

  async findById(id: number): Promise<EmployeeWithPermissions | null> {
    const user = await UserModel.findById(id);
    if (!user || user.role !== 'employee') return null;

    const [perms] = await pool.query<EmployeePermission[]>(
      `SELECT * FROM employee_permissions WHERE userId = ?`,
      [id]
    );

    return {
      ...user,
      permissions: perms.map(p => p.pageKey),
    };
  },

  async getPermissions(userId: number): Promise<string[]> {
    const [rows] = await pool.query<EmployeePermission[]>(
      `SELECT pageKey FROM employee_permissions WHERE userId = ?`,
      [userId]
    );
    return rows.map(r => r.pageKey);
  },

  async setPermissions(userId: number, pageKeys: string[]): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM employee_permissions WHERE userId = ?`, [userId]);
      if (pageKeys.length) {
        const values = pageKeys.map(k => [userId, k, 1]);
        await conn.query(
          `INSERT INTO employee_permissions (userId, pageKey, canWrite) VALUES ?`,
          [values]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async delete(id: number): Promise<void> {
    await UserModel.delete(id);
  },
};