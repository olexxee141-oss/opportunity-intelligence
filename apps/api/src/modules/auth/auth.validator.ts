import { z } from 'zod';

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
  workspaceName: z.string().trim().min(2).max(80),
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const emailOnlySchema = z.object({ email: emailSchema }).strict();
export const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(128),
}).strict();

export const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
export const switchWorkspaceSchema = z.object({ workspaceId: z.string().uuid() }).strict();
