import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.purelymail.com',
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
  auth: {
    user: process.env.SMTP_USER ?? 'send@flint.ma',
    pass: process.env.SMTP_PASS ?? 'QALEDuL8wt$4P2A',
  },
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
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

export async function sendAccountActivationEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Activez votre compte Ucpe',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <p style="font-size:13px;color:#6b7280;margin:0 0 24px">Activation de compte</p>
        <p style="font-size:15px;color:#111;margin:0 0 16px">
          Bienvenue sur Ucpe ! Utilisez le code ci-dessous pour activer votre compte.<br/>
          Il est valable <strong>10 minutes</strong>.
        </p>
        <div style="letter-spacing:0.3em;font-size:36px;font-weight:900;color:#111;
                    background:#f5f4f0;border-radius:12px;padding:20px 0;
                    text-align:center;margin:24px 0">
          ${otp}
        </div>
        <p style="font-size:12px;color:#9ca3af;margin:0">
          Si vous n'avez pas créé de compte, ignorez cet email.
        </p>
      </div>
    `,
  });
}
export async function sendReplyEmail(
  to: string,
  subject: string,
  body: string,
  originalSubject: string = ''
): Promise<void> {
  const year = new Date().getFullYear();
  const escapedBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = escapedBody.replace(/\n/g, '<br/>');

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">

  <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Réponse à votre message</p>

  <p style="font-size:15px;color:#111;margin:0 0 20px;">
    <strong>${subject}</strong>
  </p>

  ${originalSubject ? `
  <div style="border-left:3px solid #e5e5e5;padding-left:12px;margin-bottom:20px;">
    <span style="font-size:11px;color:#888888;">En réponse à : ${originalSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
  </div>
  ` : ''}

  <p style="font-size:14px;color:#111111;line-height:1.65;margin:0 0 24px;">${bodyHtml}</p>

  <br/>
  <p style="font-size:11px;color:#aaaaaa;margin:0;">
    Vous recevez cet email suite à votre message via notre formulaire de contact.<br/>
    © ${year} UCPE. Tous droits réservés.
  </p>

</body>
</html>`,
  });
}

export async function sendDevisReplyEmail(
  to: string,
  subject: string,
  body: string,
  totalFinal: number | null = null,
  codePromo?: string,
  promoValue?: number,
  totalProduits?: number,
): Promise<void> {
  const year = new Date().getFullYear();
  const escapedBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = escapedBody.replace(/\n/g, '<br/>');

  const discountAmount = (codePromo && promoValue != null && totalProduits != null) ? (totalProduits * promoValue) / 100 : null;
  const totalApresPromo = discountAmount != null && totalProduits != null ? totalProduits - discountAmount : null;

  const totalBlock = totalFinal !== null ? `
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
  <tbody>
    ${totalApresPromo != null ? `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#6b7280;">Total produits</td>
      <td style="padding:5px 0;font-size:13px;color:#6b7280;text-align:right;text-decoration:line-through;">${totalProduits!.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td style="padding:3px 0;font-size:12px;color:#6b7280;">Code promo <strong style="color:#111111;font-family:monospace;">${codePromo}</strong> −${promoValue}%</td>
      <td style="padding:3px 0;font-size:12px;color:#111111;text-align:right;font-weight:700;">−${discountAmount!.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#6b7280;">Après remise</td>
      <td style="padding:5px 0;font-size:13px;color:#111111;text-align:right;font-weight:700;">${totalApresPromo.toFixed(2)} € HT</td>
    </tr>
    ` : ''}
    <tr>
      <td style="padding:8px 0 2px;font-size:13px;color:#111111;font-weight:700;border-top:2px solid #111111;">Total final</td>
      <td style="padding:8px 0 2px;font-size:14px;color:#111111;text-align:right;font-weight:800;border-top:2px solid #111111;">${totalFinal.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 0 4px;font-size:11px;color:#888888;text-align:right;">${(totalFinal * 1.2).toFixed(2)} € TTC</td>
    </tr>
  </tbody>
</table>
` : '';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">

  <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Réponse à votre demande de devis</p>

  <p style="font-size:15px;color:#111;margin:0 0 20px;">
    <strong>${subject}</strong>
  </p>

  ${totalBlock}

  <p style="font-size:14px;color:#111111;line-height:1.65;margin:0 0 24px;">${bodyHtml}</p>

  <br/>
  <p style="font-size:11px;color:#aaaaaa;margin:0;">
    Vous recevez cet email suite à votre demande de devis.<br/>
    © ${year} UCPE. Tous droits réservés.
  </p>

</body>
</html>`,
  });
}

export async function sendNewDevisAdminEmail(options: {
  devisId: number;
  clientName: string;
  clientEmail: string;
  items: { title: string; quantity: number; price: number }[];
  dateEvenement?: string;
  lieuVille?: string;
  codePromo?: string;
  promoValue?: number;
  totalProduits: number;
  extraEmails?: string[];           // ← new
}): Promise<void> {
  const allRecipients = [...new Set(options.extraEmails ?? [])].filter(Boolean);
  if (!allRecipients.length) return;

  const { devisId, clientName, clientEmail, items, dateEvenement, lieuVille, codePromo, promoValue, totalProduits } = options;
  const year = new Date().getFullYear();

  const discountAmount = (codePromo && promoValue != null) ? (totalProduits * promoValue) / 100 : null;
  const totalApresPromo = discountAmount != null ? totalProduits - discountAmount : null;

  const itemsRows = items.map(i =>
    `<tr>
      <td style="padding:5px 0;font-size:13px;color:#111111;border-bottom:1px solid #f0f0f0;">${i.title}</td>
      <td style="padding:5px 0;font-size:13px;color:#6b7280;text-align:center;border-bottom:1px solid #f0f0f0;">×${i.quantity}</td>
      <td style="padding:5px 0;font-size:13px;color:#111111;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600;">${(i.price * i.quantity).toFixed(2)} € HT</td>
    </tr>`
  ).join('');

  const totalsRows = discountAmount != null && totalApresPromo != null ? `
    <tr>
      <td colspan="2" style="padding:8px 0 3px;font-size:12px;color:#6b7280;">Sous-total produits</td>
      <td style="padding:8px 0 3px;font-size:12px;color:#6b7280;text-align:right;text-decoration:line-through;">${totalProduits.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:3px 0;font-size:12px;color:#6b7280;">Code promo <strong style="color:#111111;font-family:monospace;">${codePromo}</strong> −${promoValue}%</td>
      <td style="padding:3px 0;font-size:12px;color:#111111;text-align:right;font-weight:700;">−${discountAmount.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:6px 0 2px;font-size:13px;color:#111111;font-weight:700;border-top:2px solid #111111;">Total après remise</td>
      <td style="padding:6px 0 2px;font-size:14px;color:#111111;text-align:right;font-weight:800;border-top:2px solid #111111;">${totalApresPromo.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:0 0 4px;font-size:11px;color:#888888;text-align:right;">${(totalApresPromo * 1.2).toFixed(2)} € TTC</td>
    </tr>
  ` : `
    <tr>
      <td colspan="2" style="padding:8px 0 2px;font-size:13px;color:#111111;font-weight:700;">Total estimé</td>
      <td style="padding:8px 0 2px;font-size:14px;color:#111111;text-align:right;font-weight:800;">${totalProduits.toFixed(2)} € HT</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:0 0 4px;font-size:11px;color:#888888;text-align:right;">${(totalProduits * 1.2).toFixed(2)} € TTC</td>
    </tr>
  `;

  const eventLine = dateEvenement
    ? `<br/>Événement : <strong>${new Date(dateEvenement).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>`
    : '';
  const lieuLine = lieuVille ? `<br/>Lieu : ${lieuVille}` : '';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Nouvelle demande de devis</p>
  <p style="font-size:15px;color:#111;margin:0 0 4px;">
    <strong>Devis #${devisId}</strong> — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
  </p>
  <p style="font-size:13px;color:#555;margin:0 0 20px;">
    ${clientName} &lt;${clientEmail}&gt;${eventLine}${lieuLine}
  </p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tbody>
      ${itemsRows}
      ${totalsRows}
    </tbody>
  </table>
  <br/>
  <p style="font-size:11px;color:#aaaaaa;margin:0;">
    Vous recevez cet email car une nouvelle demande de devis a été soumise sur UCPE.<br/>
    © ${year} UCPE. Tous droits réservés.
  </p>
</body>
</html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: allRecipients.join(', '),
    subject: `Nouvelle demande de devis #${devisId} — ${clientName}`,
    html,
  });
}