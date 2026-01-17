import type {
  AgentMessageEventPayload,
  AgentReasoningEventPayload,
  CodexMessageEntry,
  CodexParseError,
  CodexReasoningEntry,
  CodexSessionEntry,
  CodexSessionFileInfo,
  EventMsgPayload,
  ParsedCodexSession,
  TokenCountEventPayload,
  UserMessageEventPayload,
} from './codex-types';
import { CodexSessionEntrySchema } from './codex-types';

// ----------------------------------------------------------------------------
// Type Guards for Event Payloads
// ----------------------------------------------------------------------------

function isUserMessagePayload(payload: EventMsgPayload): payload is UserMessageEventPayload {
  return payload.type === 'user_message';
}

function isAgentMessagePayload(payload: EventMsgPayload): payload is AgentMessageEventPayload {
  return payload.type === 'agent_message';
}

function isAgentReasoningPayload(payload: EventMsgPayload): payload is AgentReasoningEventPayload {
  return payload.type === 'agent_reasoning';
}

function isTokenCountPayload(payload: EventMsgPayload): payload is TokenCountEventPayload {
  return payload.type === 'token_count';
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const CODEX_SESSIONS_PATH = `${process.env.HOME}/.codex/sessions`;

// ----------------------------------------------------------------------------
// File Discovery
// ----------------------------------------------------------------------------

/**
 * Recursively discovers all session JSONL files in the sessions directory
 * Traverses YYYY/MM/DD directory structure
 */
export async function discoverCodexSessionFiles(
  basePath: string = CODEX_SESSIONS_PATH
): Promise<CodexSessionFileInfo[]> {
  const sessionFiles: CodexSessionFileInfo[] = [];

  try {
    const glob = new Bun.Glob('**/rollout-*.jsonl');
    for await (const relativePath of glob.scan({ cwd: basePath })) {
      const filePath = `${basePath}/${relativePath}`;
      const file = Bun.file(filePath);
      const stats = await file.stat();

      // Skip empty files
      if (stats.size === 0) continue;

      sessionFiles.push({
        filePath,
        mtime: stats.mtime,
      });
    }
  } catch {
    return [];
  }

  return sessionFiles;
}

/**
 * Gets the most recent session files
 */
export async function getRecentCodexSessionFiles(
  limit: number = 3,
  basePath: string = CODEX_SESSIONS_PATH
): Promise<CodexSessionFileInfo[]> {
  const allFiles = await discoverCodexSessionFiles(basePath);

  // Sort by modification time, most recent first
  allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return allFiles.slice(0, limit);
}

// ----------------------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------------------

/**
 * Parses a single line from a Codex session JSONL file
 */
export function parseCodexSessionLine(line: string): CodexSessionEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return CodexSessionEntrySchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Parses a single line with error tracking
 */
function parseCodexSessionLineWithError(
  line: string,
  lineNumber: number,
  filePath: string
): { entry: CodexSessionEntry | null; error: CodexParseError | null } {
  const trimmed = line.trim();
  if (!trimmed) return { entry: null, error: null };

  try {
    const parsed = JSON.parse(trimmed);
    const entry = CodexSessionEntrySchema.parse(parsed);
    return { entry, error: null };
  } catch (err) {
    return {
      entry: null,
      error: {
        filePath,
        line: lineNumber,
        error: err instanceof Error ? err.message : String(err),
        raw: trimmed.slice(0, 200),
      },
    };
  }
}

/**
 * Parses an entire Codex session file
 */
export async function parseCodexSessionFile(
  fileInfo: CodexSessionFileInfo
): Promise<{ session: ParsedCodexSession; errors: CodexParseError[] }> {
  const file = Bun.file(fileInfo.filePath);
  const content = await file.text();
  const lines = content.split('\n');

  const errors: CodexParseError[] = [];
  const messages: CodexMessageEntry[] = [];
  const reasoning: CodexReasoningEntry[] = [];

  // Session metadata (from session_meta entry)
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let model: string | undefined;
  let cliVersion: string | undefined;
  let git: ParsedCodexSession['git'] | undefined;

  // Token usage (from token_count events)
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const { entry, error } = parseCodexSessionLineWithError(line, i + 1, fileInfo.filePath);

    if (error) {
      errors.push(error);
      continue;
    }

    if (!entry) continue;

    // Extract session metadata
    if (entry.type === 'session_meta') {
      sessionId = entry.payload.id;
      cwd = entry.payload.cwd;
      cliVersion = entry.payload.cli_version;
      git = entry.payload.git;
    }

    // Extract model from turn_context
    if (entry.type === 'turn_context' && entry.payload.model) {
      model = entry.payload.model;
    }

    // Extract messages and reasoning from event_msg entries
    if (entry.type === 'event_msg') {
      const payload = entry.payload;

      if (isUserMessagePayload(payload)) {
        messages.push({
          timestamp: entry.timestamp,
          role: 'user',
          content: payload.message,
        });
      } else if (isAgentMessagePayload(payload)) {
        messages.push({
          timestamp: entry.timestamp,
          role: 'assistant',
          content: payload.message,
        });
      } else if (isAgentReasoningPayload(payload)) {
        reasoning.push({
          timestamp: entry.timestamp,
          text: payload.text,
        });
      } else if (isTokenCountPayload(payload) && payload.info?.total_token_usage) {
        // Use the latest total token usage
        totalInputTokens = payload.info.total_token_usage.input_tokens;
        totalOutputTokens = payload.info.total_token_usage.output_tokens;
      }
    }
  }

  return {
    session: {
      sessionId: sessionId ?? 'unknown',
      filePath: fileInfo.filePath,
      cwd: cwd ?? 'unknown',
      model,
      cliVersion,
      git,
      messages,
      reasoning,
      tokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
      },
    },
    errors,
  };
}
