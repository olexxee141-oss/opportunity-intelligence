import type { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service.js';
export const healthController = {
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(200).json(await healthService.getStatus()); } catch (error) { next(error); }
  },
};
