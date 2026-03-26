import pool from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ContactMessage extends RowDataPacket {
  id:        number;
  name:      string;
  email:     string;
  sujet:     string;
  message:   string;
  read:      boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactReply extends RowDataPacket {
  id:         number;
  contact_id: number;
  subject:    string;
  body:       string;
  sentAt:     Date;
}

export interface CreateContactDto {
  name:    string;
  email:   string;
  sujet:   string;
  message: string;
}

export interface CreateReplyDto {
  contact_id: number;
  subject:    string;
  body:       string;
}

export const ContactModel = {

  async findAll(): Promise<ContactMessage[]> {
    const [rows] = await pool.query<ContactMessage[]>(
      'SELECT * FROM contact_messages ORDER BY createdAt DESC'
    );
    return rows;
  },

  async findById(id: number): Promise<ContactMessage | null> {
    const [rows] = await pool.query<ContactMessage[]>(
      'SELECT * FROM contact_messages WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async create(data: CreateContactDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO contact_messages (name, email, sujet, message) VALUES (?, ?, ?, ?)',
      [data.name, data.email, data.sujet, data.message]
    );
    return result.insertId;
  },

  async markAsRead(id: number): Promise<void> {
    await pool.query(
      'UPDATE contact_messages SET `read` = 1 WHERE id = ?',
      [id]
    );
  },

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM contact_messages WHERE id = ?', [id]);
  },

  async countUnread(): Promise<number> {
    const [[{ total }]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM contact_messages WHERE `read` = 0'
    );
    return Number(total);
  },

  // ── Replies ──────────────────────────────────────────────────────────────

  async createReply(data: CreateReplyDto): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO contact_replies (contact_id, subject, body) VALUES (?, ?, ?)',
      [data.contact_id, data.subject, data.body]
    );
    return result.insertId;
  },

  async findRepliesByContactId(contact_id: number): Promise<ContactReply[]> {
    const [rows] = await pool.query<ContactReply[]>(
      'SELECT * FROM contact_replies WHERE contact_id = ? ORDER BY sentAt ASC',
      [contact_id]
    );
    return rows;
  },

  async hasReplies(contact_id: number): Promise<boolean> {
    const [[{ total }]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS total FROM contact_replies WHERE contact_id = ?',
      [contact_id]
    );
    return Number(total) > 0;
  },
};