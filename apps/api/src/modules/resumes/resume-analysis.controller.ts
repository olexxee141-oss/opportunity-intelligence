import type { NextFunction, Request, Response } from 'express';
import { resumeAnalysisService } from './resume-analysis.service.js';

function context(req: Request) {
  if (!req.auth || !req.workspace) throw new Error('Authenticated workspace context is missing');
  return { workspaceId: req.workspace.id, userId: req.auth.userId, resumeId: req.params.id! };
}

export const resumeAnalysisController = {
  async analyze(req: Request, res: Response, next: NextFunction) {
    try {
      const c = context(req);
      res.status(202).json({ analysis: await resumeAnalysisService.analyze(c.workspaceId, c.userId, c.resumeId) });
    } catch (error) { next(error); }
  },
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const c = context(req);
      res.status(200).json({ analyses: await resumeAnalysisService.list(c.workspaceId, c.userId, c.resumeId) });
    } catch (error) { next(error); }
  },
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const c = context(req);
      res.status(200).json({ analysis: await resumeAnalysisService.get(c.workspaceId, c.userId, c.resumeId, req.params.analysisId!) });
    } catch (error) { next(error); }
  },
  async reviewProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const c = context(req);
      res.status(200).json({ proposal: await resumeAnalysisService.reviewProposal({
        ...c, analysisId: req.params.analysisId!, proposalId: req.params.proposalId!,
        decision: req.body.decision,
      }) });
    } catch (error) { next(error); }
  },
};
