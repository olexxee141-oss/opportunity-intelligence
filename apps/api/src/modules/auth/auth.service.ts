import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { emailService } from '../../services/email.service.js';
import { authDb } from './auth.db.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const appError = (message: string, statusCode: number, code: string) =>
  Object.assign(new Error(message), { statusCode, code });

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function createOpaqueToken(): string { return randomBytes(32).toString('base64url'); }

async function createAccessToken(user: { id: string; email: string }, workspaceId?: string) {
  return new SignJWT({ email: user.email, emailVerified: true, ...(workspaceId ? { workspaceId } : {}) })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.ACCESS_TOKEN_TTL_SECONDS).sign(accessSecret);
}

async function issueSession(user: { id: string; email: string }, workspaceId?: string) {
  const refreshToken = createOpaqueToken();
  await authDb.createRefreshSession({
    userId: user.id, familyId: randomUUID(), tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });
  return { accessToken: await createAccessToken(user, workspaceId), refreshToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
}

async function sendVerification(user: { id: string; email: string; displayName: string | null }) {
  const token = createOpaqueToken();
  await authDb.createEmailToken({
    userId: user.id, type: 'EMAIL_VERIFICATION', tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  try {
    await emailService.sendVerificationEmail({ to: user.email, displayName: user.displayName ?? 'there', token });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'Unable to send verification email through Resend');
  }
}

export const authService = {
  async register(input: { email: string; password: string; displayName: string; workspaceName: string }) {
    if (await authDb.findUserByEmail(input.email)) throw appError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const slugBase = input.workspaceName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'workspace';
    const { user, workspace } = await authDb.createUserWithWorkspace({
      ...input, passwordHash, workspaceSlug: `${slugBase}-${randomBytes(4).toString('hex')}`,
    });
    await sendVerification(user);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER' as const },
      verificationRequired: true,
    };
  },

  async resendVerification(email: string) {
    const user = await authDb.findUserByEmail(email);
    if (user && !user.emailVerifiedAt && user.status === 'ACTIVE') await sendVerification(user);
  },

  async verifyEmail(token: string) {
    const userId = await authDb.consumeVerificationToken(hashToken(token));
    if (!userId) throw appError('Verification link is invalid or expired', 400, 'INVALID_VERIFICATION_TOKEN');
  },

  async requestPasswordReset(email: string) {
    const user = await authDb.findUserByEmail(email);
    if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt) return;
    const token = createOpaqueToken();
    await authDb.createEmailToken({
      userId: user.id, type: 'PASSWORD_RESET', tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    try {
      await emailService.sendPasswordResetEmail({ to: user.email, displayName: user.displayName ?? 'there', token });
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Unable to send password reset email through Resend');
    }
  },

  async resetPassword(token: string, password: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const reset = await authDb.resetPasswordWithToken(hashToken(token), passwordHash);
    if (!reset) throw appError('Password reset link is invalid or expired', 400, 'INVALID_PASSWORD_RESET_TOKEN');
  },

  async login(input: { email: string; password: string }) {
    const user = await authDb.findUserByEmail(input.email);
    const valid = user ? await argon2.verify(user.passwordHash, input.password).catch(() => false) : false;
    if (!user || !valid || user.status !== 'ACTIVE') throw appError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    if (!user.emailVerifiedAt) throw appError('Verify your email address before signing in', 403, 'EMAIL_NOT_VERIFIED');
    const memberships = await authDb.listUserWorkspaces(user.id);
    const session = await issueSession(user, memberships[0]?.workspace.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      workspaces: memberships.map((membership) => ({ ...membership.workspace, role: membership.role })),
      session,
    };
  },

  async refresh(token: string) {
    const existing = await authDb.findRefreshSession(hashToken(token));
    if (!existing) throw appError('Refresh session is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    if (existing.revokedAt || existing.expiresAt <= new Date() || existing.user.status !== 'ACTIVE' || !existing.user.emailVerifiedAt) {
      if (existing.revokedAt) await authDb.revokeRefreshFamily(existing.familyId);
      throw appError('Refresh session is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    }
    const nextToken = createOpaqueToken();
    const rotated = await authDb.rotateRefreshSession(existing.id, {
      userId: existing.userId, familyId: existing.familyId, tokenHash: hashToken(nextToken),
      expiresAt: new Date(Date.now() + refreshTtlMs),
    });
    if (!rotated) {
      await authDb.revokeRefreshFamily(existing.familyId);
      throw appError('Refresh session reuse detected; sign in again', 401, 'REFRESH_TOKEN_REUSED');
    }
    const memberships = await authDb.listUserWorkspaces(existing.userId);
    return {
      refreshToken: nextToken,
      accessToken: await createAccessToken(existing.user, memberships[0]?.workspace.id),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  },

  async logout(token?: string) {
    if (!token) return;
    const existing = await authDb.findRefreshSession(hashToken(token));
    if (existing) await authDb.revokeRefreshFamily(existing.familyId);
  },

  async verifyAccessToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
      if (!payload.sub || typeof payload.email !== 'string') throw new Error('Invalid token claims');
      return { id: payload.sub, email: payload.email, emailVerified: payload.emailVerified === true };
    } catch { throw appError('Access token is invalid or expired', 401, 'INVALID_ACCESS_TOKEN'); }
  },

  async createWorkspace(userId: string, name: string) {
    const slugBase = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'workspace';
    return authDb.createWorkspace(userId, name, `${slugBase}-${randomBytes(4).toString('hex')}`);
  },
  listWorkspaces(userId: string) { return authDb.listUserWorkspaces(userId); },
  async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const membership = await authDb.findMembership(userId, workspaceId);
    if (!membership || membership.workspace.status !== 'ACTIVE') throw appError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return membership;
  },
};
