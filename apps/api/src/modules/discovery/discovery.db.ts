import { prisma } from '@oi/database';

export const discoveryDb = {
  findSource(workspaceId: string, sourceId: string) {
    return prisma.source.findFirst({ where: { id: sourceId, workspaceId } });
  },
  findActiveRun(sourceId: string) {
    return prisma.sourceDiscoveryRun.findFirst({
      where: { sourceId, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    });
  },
  createRun(workspaceId: string, sourceId: string, trigger: 'MANUAL' | 'SCHEDULED') {
    return prisma.sourceDiscoveryRun.create({ data: { workspaceId, sourceId, trigger } });
  },
  markRunFailed(workspaceId: string, runId: string, message: string) {
    return prisma.sourceDiscoveryRun.updateMany({
      where: { id: runId, workspaceId },
      data: { status: 'FAILED', error: message.slice(0, 2000), completedAt: new Date() },
    });
  },
  listRuns(workspaceId: string, page: number, limit: number) {
    const where = { workspaceId };
    return prisma.$transaction([
      prisma.sourceDiscoveryRun.findMany({
        where, include: { source: { select: { id: true, name: true, baseUrl: true } } },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      prisma.sourceDiscoveryRun.count({ where }),
    ]);
  },
  listCandidates(workspaceId: string, page: number, limit: number, sourceId?: string) {
    const where = { workspaceId, ...(sourceId ? { sourceId } : {}) };
    return prisma.$transaction([
      prisma.discoveryCandidate.findMany({
        where, include: { source: { select: { id: true, name: true } } },
        orderBy: { lastSeenAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      }),
      prisma.discoveryCandidate.count({ where }),
    ]);
  },
};
