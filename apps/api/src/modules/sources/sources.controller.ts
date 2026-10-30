import type { NextFunction, Request, Response } from 'express';
import { sourceListQuerySchema } from './sources.validator.js';
import { sourcesService } from './sources.service.js';

function context(req: Request) {
  if (!req.workspace) throw new Error('Authenticated workspace context is missing');
  return { workspaceId: req.workspace.id };
}

export const sourcesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = sourceListQuerySchema.parse(req.query);
      res.status(200).json(await sourcesService.list(context(req).workspaceId, query));
    } catch (error) { next(error); }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ source: await sourcesService.get(context(req).workspaceId, req.params.id!) }); }
    catch (error) { next(error); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ source: await sourcesService.create(context(req).workspaceId, req.body) }); }
    catch (error) { next(error); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ source: await sourcesService.update(context(req).workspaceId, req.params.id!, req.body) }); }
    catch (error) { next(error); }
  },

  async archive(req: Request, res: Response, next: NextFunction) {
    try { await sourcesService.archive(context(req).workspaceId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
};
