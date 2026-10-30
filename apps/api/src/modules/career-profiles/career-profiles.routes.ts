import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware.js';
import { careerProfilesController } from './career-profiles.controller.js';
import {
  certificationSchema, educationSchema, experienceSchema, idParamsSchema,
  preferenceSchema, profileSchema, skillSchema,
} from './career-profiles.validator.js';

export const careerProfilesRoutes = Router();

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
  const parsed = idParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid record ID' } });
    return;
  }
  req.params.id = parsed.data.id;
  next();
}

careerProfilesRoutes.use(requireAuth, requireWorkspace);
careerProfilesRoutes.get('/', careerProfilesController.getMine);
careerProfilesRoutes.put('/', validateBody(profileSchema), careerProfilesController.updateMine);

careerProfilesRoutes.post('/experiences', validateBody(experienceSchema), careerProfilesController.addExperience);
careerProfilesRoutes.put('/experiences/:id', validateId, validateBody(experienceSchema), careerProfilesController.updateExperience);
careerProfilesRoutes.delete('/experiences/:id', validateId, careerProfilesController.deleteExperience);

careerProfilesRoutes.post('/educations', validateBody(educationSchema), careerProfilesController.addEducation);
careerProfilesRoutes.put('/educations/:id', validateId, validateBody(educationSchema), careerProfilesController.updateEducation);
careerProfilesRoutes.delete('/educations/:id', validateId, careerProfilesController.deleteEducation);

careerProfilesRoutes.post('/certifications', validateBody(certificationSchema), careerProfilesController.addCertification);
careerProfilesRoutes.put('/certifications/:id', validateId, validateBody(certificationSchema), careerProfilesController.updateCertification);
careerProfilesRoutes.delete('/certifications/:id', validateId, careerProfilesController.deleteCertification);

careerProfilesRoutes.put('/skills', validateBody(skillSchema), careerProfilesController.upsertSkill);
careerProfilesRoutes.delete('/skills/:id', validateId, careerProfilesController.deleteSkill);
careerProfilesRoutes.put('/preferences', validateBody(preferenceSchema), careerProfilesController.updatePreferences);
