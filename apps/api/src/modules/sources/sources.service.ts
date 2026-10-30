import { isIP } from 'node:net';
import { sourcesDb } from './sources.db.js';
import type { CreateSourceInput, SourceListQuery, UpdateSourceInput } from './sources.types.js';

const notFound = () => Object.assign(new Error('Source was not found'), { statusCode: 404, code: 'SOURCE_NOT_FOUND' });
const conflict = () => Object.assign(new Error('A source with this URL already exists in this workspace'), { statusCode: 409, code: 'SOURCE_ALREADY_EXISTS' });

function canonicalizeSourceUrl(value: string): string {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || isIP(hostname)) {
    throw Object.assign(new Error('Source URL must use a public hostname'), { statusCode: 400, code: 'INVALID_SOURCE_HOST' });
  }
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function rethrowDatabaseError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw conflict();
  throw error;
}

export const sourcesService = {
  async list(workspaceId: string, query: SourceListQuery) {
    const [items, total] = await sourcesDb.list(workspaceId, query);
    return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
  },

  async get(workspaceId: string, id: string) {
    const source = await sourcesDb.findById(workspaceId, id);
    if (!source) throw notFound();
    return source;
  },

  async create(workspaceId: string, input: CreateSourceInput) {
    try {
      return await sourcesDb.create(workspaceId, { ...input, canonicalUrl: canonicalizeSourceUrl(input.baseUrl) });
    } catch (error) {
      return rethrowDatabaseError(error);
    }
  },

  async update(workspaceId: string, id: string, input: UpdateSourceInput) {
    const current = await sourcesDb.findById(workspaceId, id);
    if (!current) throw notFound();
    try {
      const updated = await sourcesDb.update(workspaceId, id, {
        ...input,
        ...(input.baseUrl ? { canonicalUrl: canonicalizeSourceUrl(input.baseUrl) } : {}),
      });
      if (!updated) throw notFound();
      return updated;
    } catch (error) {
      return rethrowDatabaseError(error);
    }
  },

  async archive(workspaceId: string, id: string) {
    const result = await sourcesDb.archive(workspaceId, id);
    if (result.count === 0) throw notFound();
  },
};
