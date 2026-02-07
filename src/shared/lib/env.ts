import { z } from 'zod';

// Port configuration
export const PortSchema = z.coerce.number().default(3000);

// Client-safe env vars (exposed to the browser bundle via Vite `define`)
export const ClientEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_URL: z.string().optional(),
  PUBLIC_DEV_PORT: z.string().default('5173'),
});

// Server-only env vars (never exposed to client)
export const ServerEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_PROD: z.string().optional(),
  DATABASE_URL_DEV: z.string().optional(),

  // Cloudflare R2 / S3 Storage
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_REGION: z.string(),
  S3_ENDPOINT: z.string(),
  S3_BUCKET: z.string(),
  ASSETS_DOMAIN: z.string(),

  // Authentication (all optional — when absent, auth is disabled and all requests are admin)
  ADMIN_GITHUB_ID: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),

  // External Services
  AIRTABLE_BASE_ID: z.string(),
  AIRTABLE_ACCESS_TOKEN: z.string(),
  GITHUB_TOKEN: z.string(),
  FEEDBIN_USERNAME: z.string(),
  FEEDBIN_PASSWORD: z.string(),
  RAINDROP_TEST_TOKEN: z.string(),
  READWISE_TOKEN: z.string(),
  OPENAI_API_KEY: z.string(),
});

// Base environment variables schema (without refinements, allows .pick())
export const EnvSchemaBase = ClientEnvSchema.extend(ServerEnvSchema.shape);

// Full environment variables schema with refinements
export const EnvSchema = EnvSchemaBase.refine(
  (data) => {
    // Ensure at least one database URL is configured
    return !!(data.DATABASE_URL || data.DATABASE_URL_PROD || data.DATABASE_URL_DEV);
  },
  {
    message:
      'At least one database URL must be configured (DATABASE_URL, DATABASE_URL_PROD, or DATABASE_URL_DEV)',
  }
);

export type Env = z.infer<typeof EnvSchema>;

// Parse and validate environment variables
export function parseEnv(env: Record<string, string | undefined>): Env {
  return EnvSchema.parse(env);
}

// Get a validated environment variable
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const env = parseEnv(process?.env ?? {});
  return env[key];
}
