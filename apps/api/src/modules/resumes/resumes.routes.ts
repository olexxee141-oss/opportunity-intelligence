import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth, requireWorkspace } from '../../middleware/auth.middleware.js';
import { resumesController } from './resumes.controller.js';
import { resumeIdSchema } from './resumes.validator.js';

export const resumesRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!accepted.includes(file.mimetype)) {
      callback(Object.assign(new Error('Only PDF and DOCX files are accepted'), { statusCode: 400, code: 'UNSUPPORTED_FILE' }));
      return;
    }
    callback(null, true);
  },
});
function validateId(req: Request, res: Response, next: NextFunction) {
  const parsed = resumeIdSchema.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid resume ID' } }); return; }
  req.params.id = parsed.data.id;
  next();
}
function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: { code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED', message: error instanceof Error ? error.message : 'File upload failed' },
    });
  });
}
resumesRoutes.use(requireAuth, requireWorkspace);
resumesRoutes.get('/', resumesController.list);
resumesRoutes.post('/', handleUpload, resumesController.upload);
resumesRoutes.get('/:id/download', validateId, resumesController.download);
resumesRoutes.delete('/:id', validateId, resumesController.remove);
