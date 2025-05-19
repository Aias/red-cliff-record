import { z } from 'zod';

const EnvSchema = z.object({
	DATABASE_URL: z.string(),
	GITHUB_TOKEN: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	ADOBE_API_TOKEN: z.string().optional(),
	AIRTABLE_ACCESS_TOKEN: z.string().optional(),
	AIRTABLE_BASE_ID: z.string().optional(),
	ASSETS_DOMAIN: z.string().optional(),
	RAINDROP_TEST_TOKEN: z.string().optional(),
	READWISE_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

/**
 * Ensures that a required environment variable is set.
 *
 * @param key - The name of the environment variable
 * @returns The variable's value if present
 * @throws Error if the variable is undefined or empty
 */
export function requireEnv(key: keyof Env): string {
	const value = env[key];
	if (!value) {
		throw new Error(`Environment variable ${String(key)} is required`);
	}
	return value;
}
