import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DEPLOYMENT_MODE: z.enum(['saas', 'self_hosted']).default('saas'),
  MONGODB_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(30),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(30),
  REDIS_URL: z.string().min(1),
  MEILISEARCH_URL: z.string().min(1),
  MEILISEARCH_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@example.com'),
  FRONTEND_URL: z.string().url(),
  SOCKET_CORS_ORIGIN: z.string().url()
});

export const config = envSchema.parse(process.env);
