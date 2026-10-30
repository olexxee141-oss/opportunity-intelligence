import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get('/api/v1', (_req, res) => res.status(200).json({ name: 'Opportunity Intelligence API', version: 'v1' }));
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
  const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR';
  if (statusCode >= 500) logger.error({ err: error }, 'Unhandled request error');
  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 ? 'Internal server error' : error instanceof Error ? error.message : 'Request failed',
    },
  });
};
app.use(errorHandler);
