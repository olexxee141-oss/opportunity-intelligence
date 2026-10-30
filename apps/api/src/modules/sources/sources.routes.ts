import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireWorkspace, requireWorkspaceRole } from '../../middleware/auth.middleware.js';
import { sourcesController } from './sources.controller.js';
import { createSourceSchema, sourceParamsSchema, updateSourceSchema } from './sources.validator.js';

export const sourcesRoutes = Router();

function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: parsed.error.flatten() } });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

function validateId(req: Request, res: Response, next: NextFunction) {
  const parsed = sourceParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid source ID' } });
    return;
  }
  req.params.id = parsed.data.id;
  next();
}

sourcesRoutes.use(requireAuth, requireWorkspace);
sourcesRoutes.get('/', sourcesController.list);
sourcesRoutes.get('/:id', validateId, sourcesController.get);
sourcesRoutes.post('/', requireWorkspaceRole('OWNER', 'ADMIN'), validateBody(createSourceSchema), sourcesController.create);
sourcesRoutes.patch('/:id', requireWorkspaceRole('OWNER', 'ADMIN'), validateId, validateBody(updateSourceSchema), sourcesController.update);
sourcesRoutes.delete('/:id', requireWorkspaceRole('OWNER', 'ADMIN'), validateId, sourcesController.archive);
