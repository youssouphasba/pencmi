import { z } from "zod";
import { parseTrustedProxies } from "../common/security/trusted-proxies";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  DATABASE_URL: z.string().min(1),
  BACKEND_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  TRUSTED_PROXY_CIDRS: z
    .string()
    .default("")
    .refine((value) => {
      try {
        parseTrustedProxies(value);
        return true;
      } catch {
        return false;
      }
    }, "Liste de proxys IP/CIDR invalide."),
  HTTP_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(1024 * 1024)
    .default(100 * 1024),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  COOKIE_SECRET: z.string().min(16).optional(),
  REDIS_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  PASSWORD_RECOVERY_ENABLED: z.enum(['true', 'false']).default('false'),
  EMAIL_VERIFICATION_ENABLED: z.enum(['true', 'false']).default('false'),
  BUSINESS_EMAILS_ENABLED: z.enum(['true', 'false']).default('false'),
  HOTEL_SYNC_PROCESSOR_ENABLED: z.enum(['true', 'false']).default('false'),
  EMAIL_QUEUE_ENCRYPTION_KEY: z.preprocess(value => value === '' ? undefined : value, z.string().regex(/^[a-fA-F0-9]{64}$/).optional()),
  EMAIL_FROM: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3", "r2"]).default("local"),
  LOCAL_UPLOAD_DIRECTORY: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  RATE_LIMIT_TTL: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});
