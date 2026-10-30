import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { healthRoutes } from './modules/health/health.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));
app.get('/api/v1', (_req, res) => res.status(200).json({ name: 'Opportunity Intelligence API', version: 'v1' }));
app.use('/api/v1/health', healthRoutes);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  logger.error({ err: error }, 'Unhandled request error');
  res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
};
app.use(errorHandler);
