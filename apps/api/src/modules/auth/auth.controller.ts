import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { authService } from './auth.service.js';

const cookieName = 'oi_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

function setRefreshCookie(res: Response, token: string) { res.cookie(cookieName, token, cookieOptions); }
function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions;
  res.clearCookie(cookieName, options);
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      setRefreshCookie(res, result.session.refreshToken);
      res.status(201).json({ user: result.user, workspace: result.workspace, accessToken: result.session.accessToken, expiresIn: result.session.expiresIn });
    } catch (error) { next(error); }
  },
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      setRefreshCookie(res, result.session.refreshToken);
      res.status(200).json({ user: result.user, workspaces: result.workspaces, accessToken: result.session.accessToken, expiresIn: result.session.expiresIn });
    } catch (error) { next(error); }
  },
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[cookieName] as string | undefined;
      if (!token) {
        res.status(401).json({ error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh session is required' } });
        return;
      }
      const result = await authService.refresh(token);
      setRefreshCookie(res, result.refreshToken);
      res.status(200).json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
    } catch (error) { clearRefreshCookie(res); next(error); }
  },
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.cookies?.[cookieName] as string | undefined);
      clearRefreshCookie(res);
      res.status(204).send();
    } catch (error) { next(error); }
  },
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new Error('Authenticated user context is missing');
      const workspaces = await authService.listWorkspaces(req.auth.userId);
      res.status(200).json({ user: { id: req.auth.userId, email: req.auth.email }, workspaces });
    } catch (error) { next(error); }
  },
  async createWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new Error('Authenticated user context is missing');
      const workspace = await authService.createWorkspace(req.auth.userId, req.body.name);
      res.status(201).json({ workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER' } });
    } catch (error) { next(error); }
  },
  async workspaceAccess(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth || !req.params.workspaceId) throw new Error('Required request context is missing');
      const membership = await authService.assertWorkspaceAccess(req.auth.userId, req.params.workspaceId);
      res.status(200).json({ workspace: { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug, role: membership.role } });
    } catch (error) { next(error); }
  },
};
