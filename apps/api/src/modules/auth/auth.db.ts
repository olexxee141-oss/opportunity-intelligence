import { prisma } from '@oi/database';

type EmailTokenKind = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export const authDb = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  createUserWithWorkspace(input: { email: string; passwordHash: string; displayName: string; workspaceName: string; workspaceSlug: string }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: input.email, passwordHash: input.passwordHash, displayName: input.displayName } });
      const workspace = await tx.workspace.create({ data: { name: input.workspaceName, slug: input.workspaceSlug } });
      await tx.workspaceMember.create({ data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' } });
      return { user, workspace };
    });
  },
  createRefreshSession(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshSession.create({ data: input });
  },
  findRefreshSession(tokenHash: string) {
    return prisma.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } });
  },
  async rotateRefreshSession(oldId: string, input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: oldId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
      if (revoked.count !== 1) return false;
      await tx.refreshSession.create({ data: input });
      return true;
    });
  },
  revokeRefreshFamily(familyId: string) {
    return prisma.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  },
  listUserWorkspaces(userId: string) {
    return prisma.workspaceMember.findMany({
      where: { userId, workspace: { status: 'ACTIVE' } },
      select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  },
  findMembership(userId: string, workspaceId: string) {
    return prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId } }, include: { workspace: true } });
  },
  createWorkspace(userId: string, name: string, slug: string) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name, slug } });
      await tx.workspaceMember.create({ data: { userId, workspaceId: workspace.id, role: 'OWNER' } });
      return workspace;
    });
  },
  async createEmailToken(input: { userId: string; type: EmailTokenKind; tokenHash: string; expiresAt: Date }) {
    return prisma.$transaction(async (tx) => {
      await tx.emailToken.updateMany({
        where: { userId: input.userId, type: input.type, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return tx.emailToken.create({ data: input });
    });
  },
  async consumeVerificationToken(tokenHash: string) {
    return prisma.$transaction(async (tx) => {
      const token = await tx.emailToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!token || token.type !== 'EMAIL_VERIFICATION' || token.consumedAt || token.expiresAt <= new Date()) return null;
      const consumed = await tx.emailToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return null;
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: token.user.emailVerifiedAt ?? new Date() } });
      return token.user.id;
    });
  },
  async resetPasswordWithToken(tokenHash: string, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      const token = await tx.emailToken.findUnique({ where: { tokenHash } });
      if (!token || token.type !== 'PASSWORD_RESET' || token.consumedAt || token.expiresAt <= new Date()) return false;
      const consumed = await tx.emailToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
      await tx.refreshSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.emailToken.updateMany({
        where: { userId: token.userId, type: 'PASSWORD_RESET', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return true;
    });
  },
};
