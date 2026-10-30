import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function requireEmailConfig() {
  if (!resend || !env.EMAIL_FROM) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }
  return { client: resend, from: env.EMAIL_FROM, appUrl: env.APP_URL.replace(/\/$/, '') };
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

export const emailService = {
  async sendVerificationEmail(input: { to: string; displayName: string; token: string }) {
    const config = requireEmailConfig();
    const url = `${config.appUrl}/verify-email?token=${encodeURIComponent(input.token)}`;
    const name = escapeHtml(input.displayName);
    const result = await config.client.emails.send({
      from: config.from, to: input.to, subject: 'Verify your Opportunity Intelligence account',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto"><h2>Verify your email address</h2><p>Hello ${name},</p><p>Confirm your email address to activate your Opportunity Intelligence account.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#172033;color:#fff;text-decoration:none;border-radius:6px">Verify email</a></p><p>This link expires in 30 minutes. If you did not create this account, you can ignore this email.</p></div>`,
      text: `Hello ${input.displayName}, verify your Opportunity Intelligence account using this link: ${url}. This link expires in 30 minutes.`,
    });
    if (result.error) throw new Error(`Resend email delivery failed: ${result.error.message}`);
  },
  async sendPasswordResetEmail(input: { to: string; displayName: string; token: string }) {
    const config = requireEmailConfig();
    const url = `${config.appUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
    const name = escapeHtml(input.displayName);
    const result = await config.client.emails.send({
      from: config.from, to: input.to, subject: 'Reset your Opportunity Intelligence password',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto"><h2>Password reset</h2><p>Hello ${name},</p><p>We received a request to reset your password.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#172033;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p><p>This link expires in 60 minutes. If you did not request this, ignore this email. Your password will not change.</p></div>`,
      text: `Hello ${input.displayName}, reset your Opportunity Intelligence password using this link: ${url}. This link expires in 60 minutes.`,
    });
    if (result.error) throw new Error(`Resend email delivery failed: ${result.error.message}`);
  },
};
