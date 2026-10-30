import type { NextFunction, Request, Response } from 'express';
import { discoveryListQuerySchema, discoveryCandidateQuerySchema } from './discovery.validator.js';
import { discoveryService } from './discovery.service.js';

function workspaceId(req: Request) {
  if (!req.workspace) throw new Error('Authenticated workspace context is missing');
  return req.workspace.id;
}

export const discoveryController = {
  async trigger(req: Request, res: Response, next: NextFunction) {
    try {
      const run = await discoveryService.trigger(workspaceId(req), req.params.sourceId!);
      res.status(202).json({ run });
    } catch (error) { next(error); }
  },
  async listRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const query = discoveryListQuerySchema.parse(req.query);
      res.status(200).json(await discoveryService.listRuns(workspaceId(req), query.page, query.limit));
    } catch (error) { next(error); }
  },
  async listCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const query = discoveryCandidateQuerySchema.parse(req.query);
      res.status(200).json(await discoveryService.listCandidates(workspaceId(req), query.page, query.limit, query.sourceId));
    } catch (error) { next(error); }
  },
};
