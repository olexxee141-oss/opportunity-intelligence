import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_DOMAIN: z.string().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  for (const key of ['APP_URL', 'RESEND_API_KEY', 'EMAIL_FROM', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_STORAGE_BUCKET'] as const) {
    if (!value[key]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production`,
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
export const env = { ...parsed.data, APP_URL: parsed.data.APP_URL ?? 'http://localhost:5173' };
