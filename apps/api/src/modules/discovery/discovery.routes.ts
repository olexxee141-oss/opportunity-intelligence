import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth, requireWorkspace, requireWorkspaceRole } from '../../middleware/auth.middleware.js';
import { discoveryController } from './discovery.controller.js';
import { discoverySourceParamsSchema, discoveryListQuerySchema, discoveryCandidateQuerySchema } from './discovery.validator.js';

export const discoveryRoutes = Router();
discoveryRoutes.use(requireAuth, requireWorkspace);

discoveryRoutes.get('/runs', (req: Request, res: Response, next: NextFunction) => {
  const parsed = discoveryListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid discovery query', details: parsed.error.flatten() } });
    return;
  }
  req.query = parsed.data as typeof req.query;
  next();
}, discoveryController.listRuns);
discoveryRoutes.get('/candidates', (req: Request, res: Response, next: NextFunction) => {
  const parsed = discoveryCandidateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid candidate query', details: parsed.error.flatten() } });
    return;
  }
  req.query = parsed.data as typeof req.query;
  next();
}, discoveryController.listCandidates);
discoveryRoutes.post(
  '/sources/:sourceId/runs',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = discoverySourceParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid source ID' } });
      return;
    }
    req.params.sourceId = parsed.data.sourceId;
    next();
  },
  discoveryController.trigger,
);
