import type { NextFunction, Request, Response } from 'express';
import { careerProfilesService } from './career-profiles.service.js';

function context(req: Request) {
  if (!req.auth || !req.workspace) throw new Error('Authenticated workspace context is missing');
  return { workspaceId: req.workspace.id, userId: req.auth.userId };
}

export const careerProfilesController = {
  async getMine(req: Request, res: Response, next: NextFunction) {
    try { res.status(200).json({ profile: await careerProfilesService.getMine(context(req).workspaceId, context(req).userId) }); }
    catch (error) { next(error); }
  },
  async updateMine(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(200).json({ profile: await careerProfilesService.updateMine(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
  async addExperience(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(201).json({ experience: await careerProfilesService.addExperience(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
  async updateExperience(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.updateExperience(c.workspaceId, c.userId, req.params.id!, req.body); res.status(200).json({ message: 'Experience updated' }); }
    catch (error) { next(error); }
  },
  async deleteExperience(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.deleteExperience(c.workspaceId, c.userId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
  async addEducation(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(201).json({ education: await careerProfilesService.addEducation(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
  async updateEducation(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.updateEducation(c.workspaceId, c.userId, req.params.id!, req.body); res.status(200).json({ message: 'Education updated' }); }
    catch (error) { next(error); }
  },
  async deleteEducation(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.deleteEducation(c.workspaceId, c.userId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
  async addCertification(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(201).json({ certification: await careerProfilesService.addCertification(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
  async updateCertification(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.updateCertification(c.workspaceId, c.userId, req.params.id!, req.body); res.status(200).json({ message: 'Certification updated' }); }
    catch (error) { next(error); }
  },
  async deleteCertification(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.deleteCertification(c.workspaceId, c.userId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
  async upsertSkill(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(200).json({ skill: await careerProfilesService.upsertSkill(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
  async deleteSkill(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await careerProfilesService.deleteSkill(c.workspaceId, c.userId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(200).json({ preferences: await careerProfilesService.updatePreferences(c.workspaceId, c.userId, req.body) }); }
    catch (error) { next(error); }
  },
};
