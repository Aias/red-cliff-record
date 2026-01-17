/**
 * tRPC caller for CLI usage
 *
 * This creates a caller that can invoke tRPC procedures directly,
 * reusing all the query logic from the API routers.
 */

import { createCallerFactory, createTRPCContext } from '@/server/api/init';
import { appRouter } from '@/server/api/root';

// Suppress tRPC timing logs in CLI context
process.env.RCR_CLI = '1';

// Create the caller factory from the app router
const createCaller = createCallerFactory(appRouter);

/**
 * Create a tRPC caller for CLI commands
 * This reuses the exact same code paths as the frontend
 */
export function createCLICaller() {
	// Create a minimal context for CLI usage (no real HTTP headers needed)
	const ctx = createTRPCContext({
		headers: new Headers(),
	});

	return createCaller(ctx);
}

export type CLICaller = ReturnType<typeof createCLICaller>;
