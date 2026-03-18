import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type DevisStatus = 'pending' | 'processing' | 'sent' | 'rejected';

export interface DevisItem {
  productId: number;
  title: string;
  price: number;
  quantity: number;
  images?: string[];
}

export interface DevisDelivery {
  zone: 'paris' | 'oise' | 'autre' | 'enlevement';
  autreDept?: string;
  date: string;
  type: 'ECO' | 'PREMIUM';
  ecoSlot?: 'am' | 'pm';
  heurePremium?: string;
  suppSamedi?: boolean;
  suppDimanche?: boolean;
  marche?: boolean;
  ascenseur?: boolean;
  accesPlat?: boolean;
  ascenseurDims?: string;
  lieuNom?: string;
  lieuAdresse1?: string;
  lieuAdresse2?: string;
  lieuCP?: string;
  lieuVille?: string;
  lieuContact?: string;
  lieuTelFixe?: string;
  lieuTelPortable?: string;
  installationPar?: 'pro' | 'client' | 'none';
}

export interface DevisPickup {
  date: string;
  type: 'ECO' | 'PREMIUM';
  ecoSlot?: 'am' | 'pm';
  heurePremium?: string;
  suppSamedi?: boolean;
  suppDimanche?: boolean;
}

export interface Devis extends RowDataPacket {
  id: number;
  userId: number;
  items: DevisItem[];
  message: string | null;
  status: DevisStatus;
  adminNote: string | null;
  dateEvenement: string | null;
  nombreJours: number | null;
  delivery: DevisDelivery | null;
  pickup: DevisPickup | null;
  codePromo: string | null;
  totalFinal: number | null;   // ← set by admin after review
  createdAt: Date;
  updatedAt: Date;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
}

export interface CreateDevisDto {
  userId: number;
  items: DevisItem[];
  message?: string;
  dateEvenement?: string;
  nombreJours?: number;
  delivery?: DevisDelivery;
  pickup?: DevisPickup;
  codePromo?: string;
}

export const DevisModel = {
  async create(dto: CreateDevisDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO devis
         (userId, items, message, dateEvenement, nombreJours, delivery, pickup, codePromo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.userId,
        JSON.stringify(dto.items),
        dto.message        || null,
        dto.dateEvenement  || null,
        dto.nombreJours    || null,
        dto.delivery  ? JSON.stringify(dto.delivery)  : null,
        dto.pickup    ? JSON.stringify(dto.pickup)    : null,
        dto.codePromo      || null,
      ]
    );
    return result.insertId;
  },

  async findAll(filters: {
    status?: DevisStatus;
    page: number;
    pageSize: number;
  }): Promise<{ rows: any[]; total: number }> {
    const cond   = filters.status ? 'WHERE d.status = ?' : '';
    const params = filters.status ? [filters.status] : [];

    const [rows] = await pool.query<any[]>(
      `SELECT d.*, u.firstName, u.lastName, u.email, u.phone, u.address, u.country
       FROM devis d
       LEFT JOIN users u ON d.userId = u.id
       ${cond}
       ORDER BY d.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]
    );
    const [[{ total }]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM devis d ${cond}`, params
    );

    return { rows: rows.map(parseDevis), total };
  },

  async findByUser(userId: number): Promise<any[]> {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM devis WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
    return rows.map(parseDevis);
  },

  async findById(id: number): Promise<any | null> {
    const [rows] = await pool.query<any[]>(
      `SELECT d.*, u.firstName, u.lastName, u.email, u.phone, u.address, u.country
       FROM devis d
       LEFT JOIN users u ON d.userId = u.id
       WHERE d.id = ?`,
      [id]
    );
    return rows[0] ? parseDevis(rows[0]) : null;
  },

  // ── Admin updates status + optional note + optional totalFinal ──────────────
  async updateStatus(
    id: number,
    status: DevisStatus,
    adminNote?: string,
    totalFinal?: number | null,
  ): Promise<void> {
    const fields: string[] = ['status = ?', 'adminNote = COALESCE(?, adminNote)'];
    const values: unknown[] = [status, adminNote || null];

    if (totalFinal !== undefined) {
      fields.push('totalFinal = ?');
      values.push(totalFinal ?? null);
    }

    values.push(id);
    await pool.query(
      `UPDATE devis SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM devis WHERE id = ?', [id]);
  },
};

function parseDevis(row: any) {
  for (const field of ['items', 'delivery', 'pickup']) {
    if (typeof row[field] === 'string') {
      try { row[field] = JSON.parse(row[field]); } catch { row[field] = null; }
    }
  }
  if (row.totalFinal != null) row.totalFinal = parseFloat(row.totalFinal);
  return row;
}