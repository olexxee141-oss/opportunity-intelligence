import type { z } from 'zod';
import type { createSourceSchema, sourceListQuerySchema, updateSourceSchema } from './sources.validator.js';

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type SourceListQuery = z.infer<typeof sourceListQuerySchema>;
