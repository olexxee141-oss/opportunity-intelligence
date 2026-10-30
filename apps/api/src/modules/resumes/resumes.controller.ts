import type { NextFunction, Request, Response } from 'express';
import { resumesService } from './resumes.service.js';
function context(req: Request) {
  if (!req.auth || !req.workspace) throw new Error('Authenticated workspace context is missing');
  return { workspaceId: req.workspace.id, userId: req.auth.userId };
}
export const resumesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(200).json({ resumes: await resumesService.list(c.workspaceId, c.userId) }); }
    catch (error) { next(error); }
  },
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const c = context(req);
      if (!req.file) { res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Select a PDF or DOCX resume to upload' } }); return; }
      const resume = await resumesService.upload(c.workspaceId, c.userId, {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype as 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: req.file.buffer, size: req.file.size,
      });
      res.status(201).json({ resume });
    } catch (error) { next(error); }
  },
  async download(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); res.status(200).json(await resumesService.getDownloadUrl(c.workspaceId, c.userId, req.params.id!)); }
    catch (error) { next(error); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { const c = context(req); await resumesService.remove(c.workspaceId, c.userId, req.params.id!); res.status(204).send(); }
    catch (error) { next(error); }
  },
};
