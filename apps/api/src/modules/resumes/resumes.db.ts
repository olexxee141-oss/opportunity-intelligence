import { prisma } from '@oi/database';
export const resumesDb = {
  ensureProfile(workspaceId: string, userId: string) {
    return prisma.careerProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId }, update: {}, select: { id: true },
    });
  },
  findDuplicate(workspaceId: string, checksumSha256: string) {
    return prisma.resume.findUnique({ where: { workspaceId_checksumSha256: { workspaceId, checksumSha256 } }, select: { id: true } });
  },
  create(input: {
    workspaceId: string; careerProfileId: string; uploadedByUserId: string;
    fileName: string; mimeType: string; fileSizeBytes: number; storageKey: string; checksumSha256: string;
  }) {
    return prisma.resume.create({ data: { ...input, storageProvider: 'firebase' } });
  },
  list(workspaceId: string, userId: string) {
    return prisma.resume.findMany({
      where: { workspaceId, careerProfile: { userId } },
      select: { id: true, fileName: true, mimeType: true, fileSizeBytes: true, status: true, parsedAt: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },
  findOwned(workspaceId: string, userId: string, id: string) {
    return prisma.resume.findFirst({ where: { id, workspaceId, careerProfile: { userId } } });
  },
  deleteOwned(workspaceId: string, userId: string, id: string) {
    return prisma.resume.deleteMany({ where: { id, workspaceId, careerProfile: { userId } } });
  },
};
