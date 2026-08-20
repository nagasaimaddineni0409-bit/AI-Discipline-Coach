import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    'Discipline AI Clinical Review <beth.t@example.com>'
  );
}

async function sendViaResend(email: OutboundEmail, apiKey: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error('Resend rejected weekly report email', { status: res.status, body, to: email.to });
    return false;
  }
  return true;
}

async function sendViaSmtp(email: OutboundEmail): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return false;

  const port = Number(process.env.SMTP_PORT || '587');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: mailFrom(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  return true;
}

/**
 * Sends the weekly clinical letter.
 * Prefers Resend (RESEND_API_KEY), then SMTP (SMTP_HOST / USER / PASS).
 */
export async function sendReportEmail(email: OutboundEmail): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const ok = await sendViaResend(email, resendKey);
      if (ok) return true;
    } catch (err) {
      logger.error('Resend send failed', err);
    }
  }

  try {
    const ok = await sendViaSmtp(email);
    if (ok) return true;
  } catch (err) {
    logger.error('SMTP send failed', err);
  }

  logger.warn(
    'Weekly report email not sent: set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS on Cloud Functions',
    { to: email.to },
  );
  return false;
}
