import { z } from 'zod';

const sourceType = z.enum(['JOB_BOARD', 'COMPANY_CAREERS', 'AGGREGATOR', 'GOVERNMENT', 'OTHER']);
const opportunityType = z.enum(['JOB', 'INTERNSHIP', 'SCHOLARSHIP', 'GRANT', 'FREELANCE', 'OTHER']);
const crawlMethod = z.enum(['AUTO', 'HTTP', 'BROWSER']);
const sourceStatus = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']);

const httpUrl = z.string().trim().url().max(2048).refine((value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, 'URL must be an HTTP or HTTPS address without embedded credentials');

export const createSourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  baseUrl: httpUrl,
  sourceType,
  opportunityType: opportunityType.default('JOB'),
  crawlMethod: crawlMethod.default('AUTO'),
  crawlIntervalMinutes: z.number().int().min(30).max(10080).default(360),
  maxPagesPerRun: z.number().int().min(1).max(500).default(20),
  requestsPerMinute: z.number().int().min(1).max(60).default(6),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateSourceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  baseUrl: httpUrl.optional(),
  sourceType: sourceType.optional(),
  opportunityType: opportunityType.optional(),
  status: sourceStatus.optional(),
  crawlMethod: crawlMethod.optional(),
  crawlIntervalMinutes: z.number().int().min(30).max(10080).optional(),
  maxPagesPerRun: z.number().int().min(1).max(500).optional(),
  requestsPerMinute: z.number().int().min(1).max(60).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const sourceParamsSchema = z.object({ id: z.string().uuid() });

export const sourceListQuerySchema = z.object({
  status: sourceStatus.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
