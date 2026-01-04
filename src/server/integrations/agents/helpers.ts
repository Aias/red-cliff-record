import type {
	ContentBlock,
	FileEditInfo,
	MessageEntry,
	ParsedSession,
	ParseError,
	SessionEntry,
	SessionFileInfo,
	ToolUseContentBlock,
} from './types';
import { SessionEntrySchema } from './types';

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const CLAUDE_PROJECTS_PATH = `${process.env.HOME}/.claude/projects`;

// ----------------------------------------------------------------------------
// Path Utilities
// ----------------------------------------------------------------------------

/**
 * Decodes an encoded project path back to filesystem path
 * e.g., "-Users-nicktrombley-Code-acorn" → "/Users/nicktrombley/Code/acorn"
 */
export function decodeProjectPath(encoded: string): string {
	// Remove leading dash and replace remaining dashes with path separators
	return encoded.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * Encodes a filesystem path to the format used in .claude/projects
 * e.g., "/Users/nicktrombley/Code/acorn" → "-Users-nicktrombley-Code-acorn"
 */
export function encodeProjectPath(filePath: string): string {
	return filePath.replace(/\//g, '-');
}

// ----------------------------------------------------------------------------
// File Discovery
// ----------------------------------------------------------------------------

/**
 * Discovers all project directories in the Claude projects folder
 */
export async function discoverProjectDirectories(
	basePath: string = CLAUDE_PROJECTS_PATH
): Promise<string[]> {
	try {
		const projectDirs: string[] = [];

		const glob = new Bun.Glob('-*');
		for await (const entryName of glob.scan({ cwd: basePath, onlyFiles: false })) {
			const fullPath = `${basePath}/${entryName}`;
			const stats = await Bun.file(fullPath).stat();
			if (stats.isDirectory()) projectDirs.push(fullPath);
		}

		return projectDirs;
	} catch {
		return [];
	}
}

/**
 * Discovers all session JSONL files in a project directory
 */
export async function discoverSessionFiles(projectPath: string): Promise<SessionFileInfo[]> {
	try {
		const sessionFiles: SessionFileInfo[] = [];

		const glob = new Bun.Glob('*.jsonl');
		for await (const fileName of glob.scan({ cwd: projectPath })) {
			// Skip agent files for now (they're subagent conversations)
			if (fileName.startsWith('agent-')) continue;

			const filePath = `${projectPath}/${fileName}`;
			const file = Bun.file(filePath);
			const stats = await file.stat();

			// Skip empty files
			if (stats.size === 0) continue;

			const projectPathEncoded = projectPath.split('/').pop() ?? '';

			sessionFiles.push({
				filePath,
				projectPath: decodeProjectPath(projectPathEncoded),
				projectPathEncoded,
				mtime: stats.mtime,
			});
		}

		return sessionFiles;
	} catch {
		return [];
	}
}

/**
 * Gets the most recent session files across all projects
 */
export async function getRecentSessionFiles(
	limit: number = 3,
	basePath: string = CLAUDE_PROJECTS_PATH
): Promise<SessionFileInfo[]> {
	const projectDirs = await discoverProjectDirectories(basePath);
	const allFiles: SessionFileInfo[] = [];

	for (const projectDir of projectDirs) {
		const files = await discoverSessionFiles(projectDir);
		allFiles.push(...files);
	}

	// Sort by modification time, most recent first
	allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

	return allFiles.slice(0, limit);
}

/**
 * Synchronous version of getRecentSessionFiles for simpler usage
 */
export async function getRecentSessionFilesSync(
	limit: number = 3,
	basePath: string = CLAUDE_PROJECTS_PATH
): Promise<SessionFileInfo[]> {
	const allFiles: SessionFileInfo[] = [];

	try {
		const projectGlob = new Bun.Glob('-*');
		for await (const projectName of projectGlob.scan({ cwd: basePath, onlyFiles: false })) {
			const projectPath = `${basePath}/${projectName}`;
			const projectStats = await Bun.file(projectPath).stat();
			if (!projectStats.isDirectory()) continue;

			const fileGlob = new Bun.Glob('*.jsonl');
			for await (const fileName of fileGlob.scan({ cwd: projectPath })) {
				if (fileName.startsWith('agent-')) continue;

				const filePath = `${projectPath}/${fileName}`;
				const file = Bun.file(filePath);
				const stats = await file.stat();

				// Skip empty files
				if (stats.size === 0) continue;

				allFiles.push({
					filePath,
					projectPath: decodeProjectPath(projectName),
					projectPathEncoded: projectName,
					mtime: stats.mtime,
				});
			}
		}
	} catch {
		return [];
	}

	allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
	return allFiles.slice(0, limit);
}

// ----------------------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------------------

/**
 * Parses a single line from a session JSONL file
 */
export function parseSessionLine(line: string): SessionEntry | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	try {
		const parsed = JSON.parse(trimmed);
		return SessionEntrySchema.parse(parsed);
	} catch {
		return null;
	}
}

/**
 * Parses a single line with error tracking
 */
export function parseSessionLineWithError(
	line: string,
	lineNumber: number,
	filePath: string
): { entry: SessionEntry | null; error: ParseError | null } {
	const trimmed = line.trim();
	if (!trimmed) return { entry: null, error: null };

	try {
		const parsed = JSON.parse(trimmed);
		const entry = SessionEntrySchema.parse(parsed);
		return { entry, error: null };
	} catch (err) {
		return {
			entry: null,
			error: {
				filePath,
				line: lineNumber,
				error: err instanceof Error ? err.message : String(err),
				raw: trimmed.slice(0, 200), // Truncate for debugging
			},
		};
	}
}

/**
 * Parses an entire session file
 */
export async function parseSessionFile(
	fileInfo: SessionFileInfo
): Promise<{ session: ParsedSession; errors: ParseError[] }> {
	const file = Bun.file(fileInfo.filePath);
	const content = await file.text();
	const lines = content.split('\n');

	const entries: MessageEntry[] = [];
	const summaries: string[] = [];
	const fileEditsMap = new Map<string, FileEditInfo>();
	const errors: ParseError[] = [];
	let sessionId: string | undefined;
	let slug: string | undefined;
	let gitBranch: string | undefined;
	let version: string | undefined;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const { entry, error } = parseSessionLineWithError(line, i + 1, fileInfo.filePath);

		if (error) {
			errors.push(error);
			continue;
		}

		if (!entry) continue;

		// Extract session metadata from first valid entry
		if (!sessionId && 'sessionId' in entry) {
			sessionId = entry.sessionId;
		}

		// Collect summaries
		if (entry.type === 'summary') {
			summaries.push(entry.summary);
			continue;
		}

		// Collect file edit info from snapshots
		if (entry.type === 'file-history-snapshot') {
			const backups = entry.snapshot.trackedFileBackups;
			for (const [filePath, backup] of Object.entries(backups)) {
				if (typeof backup !== 'object' || backup === null) continue;

				const versionValue = Reflect.get(backup, 'version');
				const backupTimeValue = Reflect.get(backup, 'backupTime');

				if (typeof versionValue !== 'number') continue;
				if (typeof backupTimeValue !== 'string') continue;

				const existing = fileEditsMap.get(filePath);
				const editCount = versionValue;
				const lastEditTime = backupTimeValue;

				// Keep the entry with the highest edit count (most recent state)
				if (!existing || editCount > existing.editCount) {
					fileEditsMap.set(filePath, { filePath, editCount, lastEditTime });
				}
			}
			continue;
		}

		// Only collect message entries (skip system, queue-operation)
		if (!isMessageEntry(entry)) continue;

		const messageEntry: MessageEntry = entry;

		// Extract metadata
		if (!slug && messageEntry.slug) slug = messageEntry.slug;
		if (!gitBranch && messageEntry.gitBranch) gitBranch = messageEntry.gitBranch;
		if (!version && messageEntry.version) version = messageEntry.version;

		// Aggregate token usage
		if (messageEntry.message.usage) {
			totalInputTokens += messageEntry.message.usage.input_tokens;
			totalOutputTokens += messageEntry.message.usage.output_tokens;
		}

		// Strip redundant fields and add to entries
		entries.push(stripMessageEntry(messageEntry));
	}

	// Convert file edits map to sorted array (most edits first)
	const fileEdits = Array.from(fileEditsMap.values()).sort((a, b) => b.editCount - a.editCount);

	return {
		session: {
			sessionId: sessionId ?? 'unknown',
			slug,
			projectPath: fileInfo.projectPath,
			filePath: fileInfo.filePath,
			gitBranch,
			version,
			entries,
			summaries,
			fileEdits,
			tokenUsage: {
				input: totalInputTokens,
				output: totalOutputTokens,
			},
		},
		errors,
	};
}

// ----------------------------------------------------------------------------
// Content Processing
// ----------------------------------------------------------------------------

/**
 * Type guard to check if entry is a message entry
 */
export function isMessageEntry(entry: SessionEntry): entry is MessageEntry {
	return entry.type === 'user' || entry.type === 'assistant';
}

/**
 * Strips redundant/unnecessary fields from a message entry for cleaner output.
 * - Removes `slug` (redundant with session-level slug)
 * - Removes `signature` from thinking content blocks (cryptographic noise)
 */
export function stripMessageEntry(entry: MessageEntry): MessageEntry {
	// Capture slug at session level; setting to undefined means JSON.stringify will omit it.
	if (typeof entry.message.content === 'string') {
		return {
			...entry,
			slug: undefined,
		};
	}

	const strippedContent = entry.message.content.map((block) => {
		if (block.type === 'thinking') {
			// signature is optional; setting to undefined omits it in JSON output.
			return { ...block, signature: undefined };
		}
		return block;
	});

	return {
		...entry,
		slug: undefined,
		message: {
			...entry.message,
			content: strippedContent,
		},
	};
}

/**
 * Extracts all thinking blocks from a message entry
 */
export function extractThinkingBlocks(entry: MessageEntry): string[] {
	const content = entry.message.content;
	if (typeof content === 'string') return [];

	return content
		.filter((block): block is ContentBlock & { type: 'thinking' } => block.type === 'thinking')
		.map((block) => block.thinking);
}

/**
 * Extracts all tool use blocks from a message entry
 */
export function extractToolUseBlocks(
	entry: MessageEntry
): Array<{ name: string; id: string; input: ToolUseContentBlock['input'] }> {
	const content = entry.message.content;
	if (typeof content === 'string') return [];

	return content
		.filter((block): block is ToolUseContentBlock => block.type === 'tool_use')
		.map((block) => ({
			name: block.name,
			id: block.id,
			input: block.input,
		}));
}

/**
 * Extracts text content from a message entry
 */
export function extractTextContent(entry: MessageEntry): string {
	const content = entry.message.content;
	if (typeof content === 'string') return content;

	return content
		.filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
		.map((block) => block.text)
		.join('\n');
}
