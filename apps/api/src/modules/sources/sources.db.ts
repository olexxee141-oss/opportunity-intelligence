import { prisma } from '@oi/database';
import type { CreateSourceInput, SourceListQuery, UpdateSourceInput } from './sources.types.js';

export const sourcesDb = {
  list(workspaceId: string, query: SourceListQuery) {
    const where = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { baseUrl: { contains: query.search, mode: 'insensitive' as const } },
      ] } : {}),
    };
    return prisma.$transaction([
      prisma.source.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.source.count({ where }),
    ]);
  },

  findById(workspaceId: string, id: string) {
    return prisma.source.findFirst({ where: { workspaceId, id } });
  },

  create(workspaceId: string, input: CreateSourceInput & { canonicalUrl: string }) {
    return prisma.source.create({ data: { ...input, workspaceId } });
  },

  async update(workspaceId: string, id: string, input: UpdateSourceInput & { canonicalUrl?: string }) {
    const result = await prisma.source.updateMany({ where: { workspaceId, id }, data: input });
    if (result.count === 0) return null;
    return this.findById(workspaceId, id);
  },

  archive(workspaceId: string, id: string) {
    return prisma.source.updateMany({ where: { workspaceId, id }, data: { status: 'ARCHIVED' } });
  },
};
