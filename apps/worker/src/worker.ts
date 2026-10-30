import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
export const systemQueue = new Queue('system', { connection });
const worker = new Worker('system', async (job) => {
  logger.info({ jobId: job.id, name: job.name }, 'Received system job');
  if (job.name === 'health-check') return { processedAt: new Date().toISOString() };
  throw new Error(`Unsupported system job: ${job.name}`);
}, { connection });
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Job completed'));
worker.on('failed', (job, error) => logger.error({ jobId: job?.id, err: error }, 'Job failed'));
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await worker.close(); await systemQueue.close(); await connection.quit(); process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
logger.info('Worker process started');
