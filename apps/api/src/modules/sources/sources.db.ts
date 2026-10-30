import { prisma } from '@oi/database';
import type { CreateSourceInput, SourceListQuery, UpdateSourceInput } from './sources.types.js';

type WithoutUndefined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

function omitUndefined<T extends object>(value: T): WithoutUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as WithoutUndefined<T>;
}

export const sourcesDb = {
  list(workspaceId: string, query: SourceListQuery) {
    const where = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { baseUrl: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
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
    return prisma.source.create({
      data: omitUndefined({ ...input, workspaceId }),
    });
  },

  async update(workspaceId: string, id: string, input: UpdateSourceInput & { canonicalUrl?: string }) {
    const result = await prisma.source.updateMany({
      where: { workspaceId, id },
      data: omitUndefined(input),
    });
    if (result.count === 0) return null;
    return this.findById(workspaceId, id);
  },

  archive(workspaceId: string, id: string) {
    return prisma.source.updateMany({ where: { workspaceId, id }, data: { status: 'ARCHIVED' } });
  },
};
