import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth, requireWorkspace, requireWorkspaceRole } from '../../middleware/auth.middleware.js';
import { discoveryController } from './discovery.controller.js';
import { discoverySourceParamsSchema } from './discovery.validator.js';

export const discoveryRoutes = Router();
discoveryRoutes.use(requireAuth, requireWorkspace);

discoveryRoutes.get('/runs', discoveryController.listRuns);
discoveryRoutes.get('/candidates', discoveryController.listCandidates);
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
