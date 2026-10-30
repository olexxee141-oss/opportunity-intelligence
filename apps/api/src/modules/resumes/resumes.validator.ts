import { z } from 'zod';
export const resumeIdSchema = z.object({ id: z.string().uuid() }).strict();
