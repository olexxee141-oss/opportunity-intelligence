import { z } from 'zod';

export const discoverySourceParamsSchema = z.object({ sourceId: z.string().uuid() });
export const discoveryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const discoveryCandidateQuerySchema = discoveryListQuerySchema.extend({
  sourceId: z.string().uuid().optional(),
});
