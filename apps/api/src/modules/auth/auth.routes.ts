import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authController } from './auth.controller.js';
import {
  emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema,
  tokenSchema, workspaceParamsSchema,
} from './auth.validator.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

export const authRoutes = Router();

function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: result.error.flatten() } });
      return;
    }
    req.body = result.data;
    next();
  };
}

const workspaceCreateSchema = z.object({ name: z.string().trim().min(2).max(80) }).strict();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });

authRoutes.post('/register', authLimiter, validateBody(registerSchema), authController.register);
authRoutes.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/email/verification/resend', emailLimiter, validateBody(emailOnlySchema), authController.resendVerification);
authRoutes.post('/email/verification/confirm', emailLimiter, validateBody(tokenSchema), authController.verifyEmail);
authRoutes.post('/password/forgot', emailLimiter, validateBody(emailOnlySchema), authController.requestPasswordReset);
authRoutes.post('/password/reset', emailLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
authRoutes.post('/refresh', authLimiter, authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.post('/workspaces', requireAuth, validateBody(workspaceCreateSchema), authController.createWorkspace);
authRoutes.get('/workspaces/:workspaceId', requireAuth, (req, res, next) => {
  const parsed = workspaceParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid workspace ID' } });
    return;
  }
  req.params.workspaceId = parsed.data.workspaceId;
  void authController.workspaceAccess(req, res, next);
});
