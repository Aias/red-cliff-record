/**
 * Ensures that a required environment variable is set.
 *
 * @param key - The name of the environment variable
 * @returns The variable's value if present
 * @throws Error if the variable is undefined or empty
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}
