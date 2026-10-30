import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
  workspaceName: z.string().trim().min(2).max(80),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
export const switchWorkspaceSchema = z.object({ workspaceId: z.string().uuid() }).strict();
