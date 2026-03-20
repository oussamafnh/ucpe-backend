import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? 'smtp.purelymail.com',
  port:   Number(process.env.SMTP_PORT ?? 465),
  secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
  auth: {
    user: process.env.SMTP_USER ?? 'send@flint.ma',
    pass: process.env.SMTP_PASS ?? 'QALEDuL8wt$4P2A',
  },
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? '"Flint" <send@flint.ma>',
    to,
    subject: 'Votre code de réinitialisation',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <p style="font-size:13px;color:#6b7280;margin:0 0 24px">Réinitialisation du mot de passe</p>
        <p style="font-size:15px;color:#111;margin:0 0 16px">
          Utilisez le code ci-dessous pour réinitialiser votre mot de passe.<br/>
          Il est valable <strong>10 minutes</strong>.
        </p>
        <div style="letter-spacing:0.3em;font-size:36px;font-weight:900;color:#111;
                    background:#f5f4f0;border-radius:12px;padding:20px 0;
                    text-align:center;margin:24px 0">
          ${otp}
        </div>
        <p style="font-size:12px;color:#9ca3af;margin:0">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
      </div>
    `,
  });
}