import { cursorSchema } from '@aias/hozo';
import { Database } from 'bun:sqlite';
import { like } from 'drizzle-orm';
import { createCursorConnection } from '@/server/db/connections/cursor-sqlite';
import type {
	CursorComposerMetadata,
	CursorMessageEntry,
	CursorParseError,
	ParsedCursorSession,
} from './cursor-types';
import { CursorBubbleSchema, CursorComposerDataSchema } from './cursor-types';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const CURSOR_WORKSPACE_STORAGE_PATH = `${Bun.env.HOME}/Library/Application Support/Cursor/User/workspaceStorage`;

// ----------------------------------------------------------------------------
// Bubble Extraction
// ----------------------------------------------------------------------------

/**
 * Extracts all bubble messages from the global storage database using Drizzle
 */
function extractBubbles(db: Awaited<ReturnType<typeof createCursorConnection>>['db']): {
	bubbles: Map<string, Array<{ key: string; value: string | null; index: number }>>;
	errors: CursorParseError[];
} {
	const bubbles = new Map<string, Array<{ key: string; value: string | null; index: number }>>();
	const errors: CursorParseError[] = [];

	// Query bubbleId:* keys from cursorDiskKV (synchronous with bun-sqlite)
	const rows = db
		.select({
			key: cursorSchema.cursorDiskKv.key,
			value: cursorSchema.cursorDiskKv.value,
		})
		.from(cursorSchema.cursorDiskKv)
		.where(like(cursorSchema.cursorDiskKv.key, 'bubbleId:%'))
		.all();

	let index = 0;
	for (const row of rows) {
		if (!row.key) continue;

		// Parse key: bubbleId:{composerId}:{bubbleId}
		const parts = row.key.split(':');
		if (parts.length !== 3) {
			errors.push({ key: row.key, error: 'Invalid key format' });
			continue;
		}

		const composerId = parts[1];
		if (!composerId) continue;

		const existing = bubbles.get(composerId) ?? [];
		existing.push({ key: row.key, value: row.value, index });
		bubbles.set(composerId, existing);
		index++;
	}

	return { bubbles, errors };
}

/**
 * Parses a bubble row into a message entry
 */
function parseBubbleRow(row: { key: string; value: string | null }): {
	message: CursorMessageEntry | null;
	error: CursorParseError | null;
} {
	if (!row.value) {
		return { message: null, error: null };
	}

	try {
		const parsed = JSON.parse(row.value);
		const bubble = CursorBubbleSchema.parse(parsed);

		const text = bubble.text.trim();
		if (!text) {
			return { message: null, error: null };
		}

		return {
			message: {
				bubbleId: bubble.bubbleId,
				role: bubble.type === 1 ? 'user' : 'assistant',
				content: text,
				isAgentic: bubble.isAgentic,
				requestId: bubble.requestId,
			},
			error: null,
		};
	} catch (err) {
		return {
			message: null,
			error: {
				key: row.key,
				error: err instanceof Error ? err.message : String(err),
				raw: row.value?.slice(0, 200),
			},
		};
	}
}

// ----------------------------------------------------------------------------
// Composer Metadata
// ----------------------------------------------------------------------------

/**
 * Extracts composer metadata from workspace databases
 */
async function extractComposerMetadata(): Promise<Map<string, CursorComposerMetadata>> {
	const metadata = new Map<string, CursorComposerMetadata>();

	try {
		const glob = new Bun.Glob('*');
		for await (const dirName of glob.scan({ cwd: CURSOR_WORKSPACE_STORAGE_PATH })) {
			const workspacePath = `${CURSOR_WORKSPACE_STORAGE_PATH}/${dirName}`;
			const workspaceStats = await Bun.file(workspacePath).stat();
			if (!workspaceStats.isDirectory()) continue;

			const dbPath = `${workspacePath}/state.vscdb`;
			const dbFile = Bun.file(dbPath);

			if (!(await dbFile.exists()) || dbFile.size === 0) continue;

			try {
				// Use Bun's SQLite directly for workspace DBs (simpler than creating separate Drizzle connections)
				const workspaceDb = new Database(dbPath, { readonly: true });

				try {
					const stmt = workspaceDb.query(
						"SELECT value FROM ItemTable WHERE key = 'composer.composerData'"
					);
					const row = stmt.get();

					if (row && typeof row === 'object') {
						const rawValue = Reflect.get(row, 'value');
						let valueStr: string | null = null;

						if (typeof rawValue === 'string') {
							valueStr = rawValue;
						} else if (rawValue instanceof Uint8Array) {
							valueStr = new TextDecoder().decode(rawValue);
						} else if (rawValue instanceof ArrayBuffer) {
							valueStr = new TextDecoder().decode(new Uint8Array(rawValue));
						}

						if (valueStr) {
							const parsed = JSON.parse(valueStr);
							const validated = CursorComposerDataSchema.safeParse(parsed);

							if (validated.success) {
								for (const composer of validated.data.allComposers) {
									const existing = metadata.get(composer.composerId);
									if (!existing || (composer.lastUpdatedAt ?? 0) > (existing.lastUpdatedAt ?? 0)) {
										metadata.set(composer.composerId, composer);
									}
								}
							}
						}
					}
				} finally {
					workspaceDb.close();
				}
			} catch {
				// Skip workspaces that can't be read
			}
		}
	} catch {
		// Ignore errors reading workspace dirs
	}

	return metadata;
}

// ----------------------------------------------------------------------------
// Session Building
// ----------------------------------------------------------------------------

/**
 * Builds parsed sessions from bubbles and metadata
 */
function buildSessions(
	bubbles: Map<string, Array<{ key: string; value: string | null; index: number }>>,
	metadata: Map<string, CursorComposerMetadata>
): { sessions: ParsedCursorSession[]; errors: CursorParseError[] } {
	const sessions: ParsedCursorSession[] = [];
	const errors: CursorParseError[] = [];

	for (const [composerId, rows] of bubbles) {
		// Sort by index (insertion order from query)
		rows.sort((a, b) => a.index - b.index);

		const messages: CursorMessageEntry[] = [];

		for (const row of rows) {
			const { message, error } = parseBubbleRow(row);
			if (error) {
				errors.push(error);
				continue;
			}
			if (message) {
				messages.push(message);
			}
		}

		if (messages.length === 0) continue;

		const meta = metadata.get(composerId);

		sessions.push({
			composerId,
			name: meta?.name,
			createdAt: meta?.createdAt,
			lastUpdatedAt: meta?.lastUpdatedAt,
			mode: meta?.unifiedMode ?? meta?.forceMode,
			branch: meta?.committedToBranch ?? meta?.createdOnBranch,
			messages,
			stats: {
				linesAdded: meta?.totalLinesAdded,
				linesRemoved: meta?.totalLinesRemoved,
				filesChanged: meta?.filesChangedCount,
			},
		});
	}

	// Sort by lastUpdatedAt descending (most recent first)
	sessions.sort((a, b) => (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0));

	return { sessions, errors };
}

// ----------------------------------------------------------------------------
// Main Extraction
// ----------------------------------------------------------------------------

/**
 * Extracts recent Cursor sessions using Drizzle connection
 */
export async function getRecentCursorSessions(limit: number = 10): Promise<{
	sessions: ParsedCursorSession[];
	errors: CursorParseError[];
}> {
	const { db, client } = await createCursorConnection();

	try {
		// Extract bubbles using Drizzle (synchronous with bun-sqlite)
		const { bubbles, errors: bubbleErrors } = extractBubbles(db);

		// Extract metadata from workspaces
		const metadata = await extractComposerMetadata();

		// Build sessions
		const { sessions, errors: parseErrors } = buildSessions(bubbles, metadata);

		return {
			sessions: sessions.slice(0, limit),
			errors: [...bubbleErrors, ...parseErrors],
		};
	} catch (err) {
		return {
			sessions: [],
			errors: [
				{
					key: 'database',
					error: err instanceof Error ? err.message : 'Could not open global storage database',
				},
			],
		};
	} finally {
		client.close();
	}
}
