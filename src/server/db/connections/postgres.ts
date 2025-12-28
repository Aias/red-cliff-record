import { relations, schema } from '@aias/hozo';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sql';

const createDb = () => drizzle(Bun.env.DATABASE_URL!, { schema, relations });
type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as {
	db: Database | undefined;
	lastDbFlush: number | undefined;
};

// Minimum time between flushes (10 seconds)
const DB_FLUSH_COOLDOWN_MS = 10_000;

/**
 * Flush the database connection pool.
 * Used to recover from stale type caches after database restores.
 * Rate-limited to prevent repeated flushes from cascading errors.
 */
export function flushDbConnection(): boolean {
	const now = Date.now();
	const lastFlush = globalForDb.lastDbFlush ?? 0;

	if (now - lastFlush < DB_FLUSH_COOLDOWN_MS) {
		return false; // Still in cooldown
	}

	globalForDb.lastDbFlush = now;
	globalForDb.db = createDb();
	console.warn('[DB] Connection pool flushed due to stale type cache');
	return true;
}

/**
 * Check if an error is a stale type cache error (occurs after database restores).
 */
export function isStaleTypeCacheError(error: unknown): boolean {
	if (error instanceof Error) {
		return error.message.includes('cache lookup failed for type');
	}
	return false;
}

// Initialize on first load
if (!globalForDb.db) globalForDb.db = createDb();

/**
 * Get the current database connection.
 * Uses a function so that flushDbConnection() can swap the connection.
 */
export function getDb(): Database {
	if (!globalForDb.db) globalForDb.db = createDb();
	return globalForDb.db;
}

/**
 * Database connection that auto-refreshes after flushDbConnection().
 * Uses a Proxy to delegate all property access to the current connection.
 */
export const db: Database = new Proxy({} as Database, {
	get(_, prop) {
		return Reflect.get(getDb(), prop);
	},
});

export type Db = Database;
