import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

function mailFrom(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    'Discipline AI Clinical Review <beth.t@example.com>'
  );
}

async function sendViaResend(
  email: OutboundEmail,
  apiKey: string,
): Promise<SendEmailResult> {
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
    let hint = `Resend error ${res.status}`;
    if (res.status === 403 || body.toLowerCase().includes('only send testing emails')) {
      hint =
        'Resend is in test mode: it can only email your Resend login address until you verify a domain. ' +
        'Either verify disciplineai.com, or sign into the app with the same email as your Resend account.';
    }
    return { ok: false, error: hint };
  }
  return { ok: true };
}

async function sendViaSmtp(email: OutboundEmail): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return { ok: false, error: 'SMTP not configured' };
  }

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
  return { ok: true };
}

/**
 * Sends the weekly clinical letter.
 * Prefers Resend (apiKey arg or RESEND_API_KEY), then SMTP.
 */
export async function sendReportEmail(
  email: OutboundEmail,
  apiKeyOverride?: string,
): Promise<SendEmailResult> {
  const resendKey = (apiKeyOverride ?? process.env.RESEND_API_KEY)?.trim();
  if (resendKey) {
    try {
      const result = await sendViaResend(email, resendKey);
      if (result.ok) return result;
      // Don't fall through to SMTP with a misleading "not configured" — surface Resend's reason.
      if (!process.env.SMTP_HOST?.trim()) return result;
    } catch (err) {
      logger.error('Resend send failed', err);
      return { ok: false, error: 'Resend request failed' };
    }
  }

  try {
    const smtp = await sendViaSmtp(email);
    if (smtp.ok) return smtp;
  } catch (err) {
    logger.error('SMTP send failed', err);
  }

  if (!resendKey) {
    return {
      ok: false,
      error: 'RESEND_API_KEY is missing on Cloud Functions. Set the secret and redeploy.',
    };
  }
  return { ok: false, error: 'Email delivery failed' };
}
