import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { resumeAnalysisDb } from './resume-analysis.db.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const analysisQueue = new Queue('resume-analysis', { connection: redis });

function httpError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

export const resumeAnalysisService = {
  async analyze(workspaceId: string, userId: string, resumeId: string) {
    if (!env.AI_API_KEY || !env.AI_MODEL) throw httpError(503, 'AI_NOT_CONFIGURED', 'Resume analysis is not configured');
    const resume = await resumeAnalysisDb.findReadyResume(workspaceId, userId, resumeId);
    if (!resume) throw httpError(404, 'READY_RESUME_NOT_FOUND', 'A parsed resume was not found');
    if (await resumeAnalysisDb.findActive(workspaceId, resumeId)) {
      throw httpError(409, 'ANALYSIS_ALREADY_RUNNING', 'An analysis is already queued or processing for this resume');
    }
    const analysis = await resumeAnalysisDb.createQueued({
      workspaceId, careerProfileId: resume.careerProfileId, resumeId,
      provider: 'openai-compatible', model: env.AI_MODEL,
    });
    try {
      await analysisQueue.add('analyze-resume', { analysisId: analysis.id }, {
        jobId: 'resume-analysis-' + analysis.id,
        attempts: 2, backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 500, removeOnFail: 1000,
      });
    } catch (error) {
      await resumeAnalysisDb.markFailed(analysis.id, 'Analysis could not be scheduled');
      throw error;
    }
    return analysis;
  },
  list(workspaceId: string, userId: string, resumeId: string) {
    return resumeAnalysisDb.listOwned(workspaceId, userId, resumeId);
  },
  async get(workspaceId: string, userId: string, resumeId: string, analysisId: string) {
    const analysis = await resumeAnalysisDb.findOwned(workspaceId, userId, resumeId, analysisId);
    if (!analysis) throw httpError(404, 'ANALYSIS_NOT_FOUND', 'Resume analysis was not found');
    return analysis;
  },
  async reviewProposal(input: {
    workspaceId: string; userId: string; resumeId: string; analysisId: string; proposalId: string; decision: 'ACCEPT' | 'REJECT';
  }) {
    const result = await resumeAnalysisDb.reviewProposal(input);
    if (!result) throw httpError(404, 'PROPOSAL_NOT_FOUND', 'Pending proposal was not found');
    return result;
  },
};
