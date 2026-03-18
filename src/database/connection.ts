import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

export const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
});

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  logger.info('✅  MySQL connected');
  conn.release();
}

export default pool;
