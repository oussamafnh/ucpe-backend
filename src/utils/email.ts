import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_PORT === '465',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  attachmentUrl?: string;
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from:    process.env.MAIL_FROM || 'noreply@app.com',
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    });
    logger.info(`📧  Email sent to ${opts.to}`);
  } catch (err) {
    logger.error('Email send failed', err);
    throw err;
  }
}
