import type { NextFunction, Request, Response } from 'express';
import { authService } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; email: string };
      workspace?: { id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    const payload = await authService.verifyAccessToken(header.slice(7));
    req.auth = { userId: payload.id, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: { code: 'INVALID_ACCESS_TOKEN', message: 'Access token is invalid or expired' } });
  }
}

export async function requireWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    const workspaceId = req.header('x-workspace-id');
    if (!workspaceId) {
      res.status(400).json({ error: { code: 'WORKSPACE_REQUIRED', message: 'X-Workspace-Id header is required' } });
      return;
    }
    const membership = await authService.assertWorkspaceAccess(req.auth.userId, workspaceId);
    req.workspace = { id: membership.workspaceId, role: membership.role };
    next();
  } catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR';
    res.status(statusCode).json({ error: { code, message: statusCode === 500 ? 'Internal server error' : 'Workspace access denied' } });
  }
}

export function requireWorkspaceRole(...roles: Array<'OWNER' | 'ADMIN' | 'MEMBER'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.workspace || !roles.includes(req.workspace.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient workspace permissions' } });
      return;
    }
    next();
  };
}
