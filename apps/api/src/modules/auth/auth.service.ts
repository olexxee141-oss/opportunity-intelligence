import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { authDb } from './auth.db.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const appError = (message: string, statusCode: number, code: string) =>
  Object.assign(new Error(message), { statusCode, code });

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
async function createAccessToken(user: { id: string; email: string }, workspaceId?: string) {
  return new SignJWT({ email: user.email, ...(workspaceId ? { workspaceId } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.ACCESS_TOKEN_TTL_SECONDS)
    .sign(accessSecret);
}
async function issueSession(user: { id: string; email: string }, workspaceId?: string) {
  const refreshToken = createRefreshToken();
  await authDb.createRefreshSession({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });
  return { accessToken: await createAccessToken(user, workspaceId), refreshToken, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
}

export const authService = {
  async register(input: { email: string; password: string; displayName: string; workspaceName: string }) {
    if (await authDb.findUserByEmail(input.email)) throw appError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const slugBase = input.workspaceName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'workspace';
    const { user, workspace } = await authDb.createUserWithWorkspace({
      ...input, passwordHash, workspaceSlug: `${slugBase}-${randomBytes(4).toString('hex')}`,
    });
    const session = await issueSession(user, workspace.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER' as const },
      session,
    };
  },

  async login(input: { email: string; password: string }) {
    const user = await authDb.findUserByEmail(input.email);
    const valid = user ? await argon2.verify(user.passwordHash, input.password).catch(() => false) : false;
    if (!user || !valid || user.status !== 'ACTIVE') throw appError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    const memberships = await authDb.listUserWorkspaces(user.id);
    const firstWorkspace = memberships[0];
    const session = await issueSession(user, firstWorkspace?.workspace.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      workspaces: memberships.map((membership) => ({ ...membership.workspace, role: membership.role })),
      session,
    };
  },

  async refresh(token: string) {
    const existing = await authDb.findRefreshSession(hashToken(token));
    if (!existing || existing.revokedAt || existing.expiresAt <= new Date() || existing.user.status !== 'ACTIVE') {
      throw appError('Refresh session is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    }
    const nextToken = createRefreshToken();
    const rotated = await authDb.rotateRefreshSession(existing.id, {
      userId: existing.userId, tokenHash: hashToken(nextToken), expiresAt: new Date(Date.now() + refreshTtlMs),
    });
    if (!rotated) throw appError('Refresh session has already been used', 401, 'REFRESH_TOKEN_REUSED');
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
    if (existing && !existing.revokedAt) await authDb.revokeRefreshSession(existing.id);
  },

  async verifyAccessToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
      if (!payload.sub || typeof payload.email !== 'string') throw new Error('Invalid token claims');
      return { id: payload.sub, email: payload.email };
    } catch {
      throw appError('Access token is invalid or expired', 401, 'INVALID_ACCESS_TOKEN');
    }
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
