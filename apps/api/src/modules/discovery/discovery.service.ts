import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { discoveryDb } from './discovery.db.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const discoveryQueue = new Queue('source-discovery', { connection: redis });

function httpError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

export const discoveryService = {
  async trigger(workspaceId: string, sourceId: string) {
    const source = await discoveryDb.findSource(workspaceId, sourceId);
    if (!source) throw httpError(404, 'SOURCE_NOT_FOUND', 'Source was not found');
    if (source.status !== 'ACTIVE') throw httpError(409, 'SOURCE_NOT_ACTIVE', 'Only active sources can be discovered');
    if (source.channel !== 'WEBSITE' && source.channel !== 'FEED') {
      throw httpError(409, 'SOURCE_CONNECTOR_NOT_AVAILABLE', 'This source channel requires a provider connector that is not implemented yet');
    }
    const lease = await discoveryDb.claimManualSource(workspaceId, sourceId, source.crawlIntervalMinutes);
    if (!lease) throw httpError(409, 'DISCOVERY_ALREADY_RUNNING', 'A discovery run is already queued or running for this source');

    const run = await discoveryDb.createRun(workspaceId, sourceId, 'MANUAL');
    try {
      await discoveryQueue.add('discover-source', { runId: run.id, sourceId, workspaceId }, {
        jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000, removeOnFail: 2000,
      });
      return run;
    } catch (error) {
      await discoveryDb.markRunFailed(workspaceId, run.id, 'Unable to enqueue discovery job');
      await discoveryDb.releaseSourceLease(sourceId);
      throw error;
    }
  },
  async listRuns(workspaceId: string, page: number, limit: number) {
    const [items, total] = await discoveryDb.listRuns(workspaceId, page, limit);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },
  async listCandidates(workspaceId: string, page: number, limit: number, sourceId?: string) {
    const [items, total] = await discoveryDb.listCandidates(workspaceId, page, limit, sourceId);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },
};
