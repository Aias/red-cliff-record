import { z } from 'zod';

// Port configuration
export const PortSchema = z.coerce.number().default(3000);

// Environment variables schema
export const EnvSchema = z.object({
	// Node environment
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

	// Public URLs
	PUBLIC_URL: z.string().optional(),
	PUBLIC_DEV_PORT: z.string().default('5173'),

	// Database
	DATABASE_URL: z.string(),
	DATABASE_URL_LOCAL: z.string().optional(),
	DATABASE_URL_REMOTE: z.string().optional(),
	DATABASE_URL_DEV: z.string().optional(),

	// Cloudflare R2 / S3 Storage
	CLOUDFLARE_ACCOUNT_ID: z.string(),
	S3_ACCESS_KEY_ID: z.string(),
	S3_SECRET_ACCESS_KEY: z.string(),
	S3_REGION: z.string(),
	S3_ENDPOINT: z.string(),
	S3_BUCKET: z.string(),
	ASSETS_DOMAIN: z.string(),

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

export type Env = z.infer<typeof EnvSchema>;

// Parse and validate environment variables
export function parseEnv(env: Record<string, string | undefined>): Env {
	return EnvSchema.parse(env);
}

// Get a validated environment variable
export function getEnv<K extends keyof Env>(key: K): Env[K] {
	const env = parseEnv(typeof process !== 'undefined' && process.env ? process.env : {});
	return env[key];
}
