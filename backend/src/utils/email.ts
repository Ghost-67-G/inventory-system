import { Resend } from 'resend';
import { config } from '../config';
import { logger } from './logger';

let resendClient: Resend | null = null;

if (config.RESEND_API_KEY) {
  resendClient = new Resend(config.RESEND_API_KEY);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resendClient) {
    if (config.NODE_ENV === 'development') {
      logger.info('email_dev_fallback', { to, subject, html });
      return;
    }
    logger.warn('email_skip_no_api_key', { to, subject });
    return;
  }

  const result = await resendClient.emails.send({
    from: config.EMAIL_FROM,
    to,
    subject,
    html
  });

  if (result.error) {
    logger.error('email_send_failed', { to, subject, error: result.error });
  }
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${config.FRONTEND_URL}/verify-email?token=${token}`;
  const html = `
    <p>Hi ${name},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in <strong>24 hours</strong>.</p>
    <p>If you did not create an account, you can safely ignore this email.</p>
  `;
  await sendEmail(to, 'Verify your email address', html);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${config.FRONTEND_URL}/reset-password?token=${token}`;
  const html = `
    <p>Hi ${name},</p>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in <strong>1 hour</strong>.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  await sendEmail(to, 'Reset your password', html);
}

export async function sendWelcomeEmail(to: string, name: string, tenantName: string): Promise<void> {
  const html = `
    <p>Hi ${name},</p>
    <p>Welcome to <strong>${tenantName}</strong>! Your email has been verified and your account is ready.</p>
    <p>You can now log in and start managing your inventory.</p>
  `;
  await sendEmail(to, `Welcome to ${tenantName}!`, html);
}
