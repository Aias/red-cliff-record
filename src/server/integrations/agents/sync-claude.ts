import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { CLAUDE_PROJECTS_PATH, getRecentSessionFiles, parseSessionFile } from './helpers';
import type { ParsedSession, ParseError } from './types';

const logger = createIntegrationLogger('agents', 'sync-claude');

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_SESSION_LIMIT = 3;

// ----------------------------------------------------------------------------
// Debug Data Types
// ----------------------------------------------------------------------------

interface ClaudeDebugData {
	sessions: ParsedSession[];
	errors: ParseError[];
	stats: {
		totalFiles: number;
		totalEntries: number;
		messageEntries: number;
		tokensUsed: {
			input: number;
			output: number;
		};
	};
	config: {
		projectsPath: string;
		sessionLimit: number;
	};
}

// ----------------------------------------------------------------------------
// Main Sync Function
// ----------------------------------------------------------------------------

export interface SyncClaudeOptions {
	/** Number of recent session files to process (default: 3) */
	sessionLimit?: number;
	/** Base path to Claude projects directory */
	projectsPath?: string;
}

/**
 * Synchronizes Claude Code session history to debug output
 *
 * This function:
 * 1. Discovers recent session files across all projects
 * 2. Parses JSONL entries from each file
 * 3. Collects message entries (user/assistant only)
 * 4. Aggregates token usage statistics
 * 5. Outputs to .temp/agents-claude-debug-{timestamp}.json
 */
export async function syncClaudeHistory(
	debug = false,
	options: SyncClaudeOptions = {}
): Promise<void> {
	const { sessionLimit = DEFAULT_SESSION_LIMIT, projectsPath = CLAUDE_PROJECTS_PATH } = options;

	const initialDebugData: ClaudeDebugData = {
		sessions: [],
		errors: [],
		stats: {
			totalFiles: 0,
			totalEntries: 0,
			messageEntries: 0,
			tokensUsed: { input: 0, output: 0 },
		},
		config: {
			projectsPath,
			sessionLimit,
		},
	};

	const debugContext = createDebugContext<ClaudeDebugData>(
		'agents-claude',
		debug,
		initialDebugData
	);

	try {
		logger.start('Starting Claude Code history sync');

		// Step 1: Discover recent session files
		logger.info(`Discovering session files in ${projectsPath}`);
		const sessionFiles = await getRecentSessionFiles(sessionLimit, projectsPath);

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
		let totalMessageEntries = 0;
		let totalInputTokens = 0;
		let totalOutputTokens = 0;

		for (const fileInfo of sessionFiles) {
			logger.info(`Processing: ${fileInfo.filePath}`);
			logger.info(`  Project: ${fileInfo.projectPath}`);
			logger.info(`  Modified: ${fileInfo.mtime.toISOString()}`);

			const { session, errors } = await parseSessionFile(fileInfo);

			// Collect session data
			if (debugContext.data) {
				debugContext.data.sessions.push(session);
				debugContext.data.errors.push(...errors);
			}

			// Aggregate stats
			totalEntries += session.entries.length + errors.length;
			totalMessageEntries += session.entries.length;
			totalInputTokens += session.tokenUsage.input;
			totalOutputTokens += session.tokenUsage.output;

			logger.info(`  Entries: ${session.entries.length} messages`);
			logger.info(`  Tokens: ${session.tokenUsage.input} in / ${session.tokenUsage.output} out`);

			if (errors.length > 0) {
				logger.warn(`  Parse errors: ${errors.length}`);
			}

			if (session.slug) {
				logger.info(`  Slug: ${session.slug}`);
			}
		}

		// Update final stats
		if (debugContext.data) {
			debugContext.data.stats.totalEntries = totalEntries;
			debugContext.data.stats.messageEntries = totalMessageEntries;
			debugContext.data.stats.tokensUsed = {
				input: totalInputTokens,
				output: totalOutputTokens,
			};
		}

		logger.complete('Claude Code history sync completed');
		logger.info(
			`Total: ${totalMessageEntries} messages, ${totalInputTokens + totalOutputTokens} tokens`
		);
	} catch (error) {
		logger.error('Error syncing Claude Code history', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output', flushError);
		});
	}
}
