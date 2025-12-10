import { cursorDbPath } from '@/server/db/connections/cursor-sqlite';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { getRecentCursorSessions } from './cursor-helpers';
import type { CursorParseError, ParsedCursorSession } from './cursor-types';

const logger = createIntegrationLogger('agents', 'sync-cursor');

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_SESSION_LIMIT = 10;

// ----------------------------------------------------------------------------
// Debug Data Types
// ----------------------------------------------------------------------------

interface CursorDebugData {
	sessions: ParsedCursorSession[];
	errors: CursorParseError[];
	stats: {
		totalSessions: number;
		totalMessages: number;
		userMessages: number;
		assistantMessages: number;
	};
	config: {
		databasePath: string;
		sessionLimit: number;
	};
}

// ----------------------------------------------------------------------------
// Main Sync Function
// ----------------------------------------------------------------------------

export interface SyncCursorOptions {
	/** Number of recent sessions to process (default: 10) */
	sessionLimit?: number;
}

/**
 * Synchronizes Cursor IDE chat history to debug output
 *
 * This function:
 * 1. Opens the global storage SQLite database
 * 2. Extracts bubble messages from cursorDiskKV table
 * 3. Enriches with composer metadata from workspace databases
 * 4. Groups messages into sessions by composerId
 * 5. Outputs to .temp/agents-cursor-debug-{timestamp}.json
 */
export async function syncCursorHistory(
	debug = false,
	options: SyncCursorOptions = {}
): Promise<void> {
	const { sessionLimit = DEFAULT_SESSION_LIMIT } = options;

	const initialDebugData: CursorDebugData = {
		sessions: [],
		errors: [],
		stats: {
			totalSessions: 0,
			totalMessages: 0,
			userMessages: 0,
			assistantMessages: 0,
		},
		config: {
			databasePath: cursorDbPath,
			sessionLimit,
		},
	};

	const debugContext = createDebugContext<CursorDebugData>(
		'agents-cursor',
		debug,
		initialDebugData
	);

	try {
		logger.start('Starting Cursor IDE history sync');

		// Extract sessions
		logger.info(`Extracting sessions from ${cursorDbPath}`);
		const { sessions, errors } = getRecentCursorSessions(sessionLimit);

		if (sessions.length === 0) {
			logger.warn('No sessions found');
			if (errors.length > 0) {
				logger.warn(`Errors: ${errors.length}`);
			}
			return;
		}

		logger.info(`Found ${sessions.length} session(s)`);

		// Calculate stats
		let totalMessages = 0;
		let userMessages = 0;
		let assistantMessages = 0;

		for (const session of sessions) {
			totalMessages += session.messages.length;

			for (const msg of session.messages) {
				if (msg.role === 'user') userMessages++;
				else assistantMessages++;
			}

			logger.info(`Session: ${session.name ?? session.composerId}`);
			logger.info(`  Messages: ${session.messages.length}`);
			if (session.mode) logger.info(`  Mode: ${session.mode}`);
			if (session.branch) logger.info(`  Branch: ${session.branch}`);
			if (session.stats.filesChanged) {
				logger.info(
					`  Changes: +${session.stats.linesAdded ?? 0}/-${session.stats.linesRemoved ?? 0} in ${session.stats.filesChanged} files`
				);
			}
		}

		// Update debug data
		if (debugContext.data) {
			debugContext.data.sessions = sessions;
			debugContext.data.errors = errors;
			debugContext.data.stats = {
				totalSessions: sessions.length,
				totalMessages,
				userMessages,
				assistantMessages,
			};
		}

		logger.complete('Cursor IDE history sync completed');
		logger.info(
			`Total: ${totalMessages} messages (${userMessages} user, ${assistantMessages} assistant)`
		);

		if (errors.length > 0) {
			logger.warn(`Parse errors: ${errors.length}`);
		}
	} catch (error) {
		logger.error('Error syncing Cursor IDE history', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output', flushError);
		});
	}
}
