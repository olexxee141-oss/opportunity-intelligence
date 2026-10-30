import { prisma } from '@oi/database';

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
  createRefreshSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshSession.create({ data: input });
  },
  findRefreshSession(tokenHash: string) {
    return prisma.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } });
  },
  async rotateRefreshSession(oldId: string, input: { userId: string; tokenHash: string; expiresAt: Date }) {
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
  revokeRefreshSession(id: string) {
    return prisma.refreshSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
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
};
