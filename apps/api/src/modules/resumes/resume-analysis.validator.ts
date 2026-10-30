import { z } from 'zod';

export const analysisIdSchema = z.object({ analysisId: z.string().uuid() }).strict();
export const proposalIdSchema = z.object({ proposalId: z.string().uuid() }).strict();
export const proposalDecisionSchema = z.object({ decision: z.enum(['ACCEPT', 'REJECT']) }).strict();
