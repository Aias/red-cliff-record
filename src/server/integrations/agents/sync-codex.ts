import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import {
	CODEX_SESSIONS_PATH,
	getRecentCodexSessionFiles,
	parseCodexSessionFile,
} from './codex-helpers';
import type { CodexParseError, ParsedCodexSession } from './codex-types';

const logger = createIntegrationLogger('agents', 'sync-codex');

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_SESSION_LIMIT = 3;

// ----------------------------------------------------------------------------
// Debug Data Types
// ----------------------------------------------------------------------------

interface CodexDebugData {
	sessions: ParsedCodexSession[];
	errors: CodexParseError[];
	stats: {
		totalFiles: number;
		totalEntries: number;
		messageCount: number;
		reasoningCount: number;
		tokensUsed: {
			input: number;
			output: number;
		};
	};
	config: {
		sessionsPath: string;
		sessionLimit: number;
	};
}

// ----------------------------------------------------------------------------
// Main Sync Function
// ----------------------------------------------------------------------------

export interface SyncCodexOptions {
	/** Number of recent session files to process (default: 3) */
	sessionLimit?: number;
	/** Base path to Codex sessions directory */
	sessionsPath?: string;
}

/**
 * Synchronizes Codex CLI session history to debug output
 *
 * This function:
 * 1. Discovers recent session files in ~/.codex/sessions/
 * 2. Parses JSONL entries from each file
 * 3. Extracts messages (user/agent) and reasoning
 * 4. Aggregates token usage statistics
 * 5. Outputs to .temp/agents-codex-debug-{timestamp}.json
 */
export async function syncCodexHistory(
	debug = false,
	options: SyncCodexOptions = {}
): Promise<void> {
	const { sessionLimit = DEFAULT_SESSION_LIMIT, sessionsPath = CODEX_SESSIONS_PATH } = options;

	const debugContext = createDebugContext('agents-codex', debug, {
		sessions: [],
		errors: [],
		stats: {
			totalFiles: 0,
			totalEntries: 0,
			messageCount: 0,
			reasoningCount: 0,
			tokensUsed: { input: 0, output: 0 },
		},
		config: {
			sessionsPath,
			sessionLimit,
		},
	} as CodexDebugData);

	try {
		logger.start('Starting Codex CLI history sync');

		// Step 1: Discover recent session files
		logger.info(`Discovering session files in ${sessionsPath}`);
		const sessionFiles = await getRecentCodexSessionFiles(sessionLimit, sessionsPath);

		if (sessionFiles.length === 0) {
			logger.warn('No session files found');
			return;
		}

		logger.info(`Found ${sessionFiles.length} recent session file(s)`);

		if (debugContext.data) {
			debugContext.data.stats.totalFiles = sessionFiles.length;
		}

		// Step 2: Parse each session file
		let totalEntries = 0;
		let totalMessages = 0;
		let totalReasoning = 0;
		let totalInputTokens = 0;
		let totalOutputTokens = 0;

		for (const fileInfo of sessionFiles) {
			logger.info(`Processing: ${fileInfo.filePath}`);
			logger.info(`  Modified: ${fileInfo.mtime.toISOString()}`);

			const { session, errors } = await parseCodexSessionFile(fileInfo);

			// Collect session data
			if (debugContext.data) {
				debugContext.data.sessions.push(session);
				debugContext.data.errors.push(...errors);
			}

			// Count entries
			const entryCount = session.messages.length + session.reasoning.length + errors.length;
			totalEntries += entryCount;
			totalMessages += session.messages.length;
			totalReasoning += session.reasoning.length;
			totalInputTokens += session.tokenUsage.input;
			totalOutputTokens += session.tokenUsage.output;

			logger.info(`  Messages: ${session.messages.length}`);
			logger.info(`  Reasoning: ${session.reasoning.length}`);
			logger.info(`  Tokens: ${session.tokenUsage.input} in / ${session.tokenUsage.output} out`);

			if (errors.length > 0) {
				logger.warn(`  Parse errors: ${errors.length}`);
			}

			if (session.model) {
				logger.info(`  Model: ${session.model}`);
			}

			if (session.git?.branch) {
				logger.info(`  Git branch: ${session.git.branch}`);
			}
		}

		// Update final stats
		if (debugContext.data) {
			debugContext.data.stats.totalEntries = totalEntries;
			debugContext.data.stats.messageCount = totalMessages;
			debugContext.data.stats.reasoningCount = totalReasoning;
			debugContext.data.stats.tokensUsed = {
				input: totalInputTokens,
				output: totalOutputTokens,
			};
		}

		logger.complete('Codex CLI history sync completed');
		logger.info(
			`Total: ${totalMessages} messages, ${totalReasoning} reasoning, ${totalInputTokens + totalOutputTokens} tokens`
		);
	} catch (error) {
		logger.error('Error syncing Codex CLI history', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output', flushError);
		});
	}
}
