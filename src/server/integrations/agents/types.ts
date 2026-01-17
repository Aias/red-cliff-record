import { z } from 'zod';

// ============================================================================
// Agent Session History Schema
// Source: ~/.claude/projects/{encoded-path}/*.jsonl (Claude Code)
//
// Each JSONL file contains one JSON object per line representing messages
// in a conversation session. This schema supports multiple agent providers.
// ============================================================================

// ----------------------------------------------------------------------------
// Token Usage (on assistant messages)
// ----------------------------------------------------------------------------

export const TokenUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  service_tier: z.string().optional(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// ----------------------------------------------------------------------------
// Structured Patch (unified diff format from Edit operations)
// ----------------------------------------------------------------------------

export const PatchHunkSchema = z.object({
  oldStart: z.number(),
  oldLines: z.number(),
  newStart: z.number(),
  newLines: z.number(),
  lines: z.array(z.string()), // Prefixed with " ", "+", or "-"
});
export type PatchHunk = z.infer<typeof PatchHunkSchema>;

// ----------------------------------------------------------------------------
// Tool Use Inputs
// ----------------------------------------------------------------------------

export const EditToolInputSchema = z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});
export type EditToolInput = z.infer<typeof EditToolInputSchema>;

export const WriteToolInputSchema = z.object({
  file_path: z.string(),
  content: z.string(),
});

export const ReadToolInputSchema = z.object({
  file_path: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const BashToolInputSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  timeout: z.number().optional(),
});
export type BashToolInput = z.infer<typeof BashToolInputSchema>;

export const GlobToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
});

export const GrepToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  include: z.string().optional(),
});

export const TaskToolInputSchema = z.object({
  description: z.string(),
  prompt: z.string(),
  subagent_type: z.string().optional(),
});

const GenericToolInputSchema = z.looseRecord(z.string(), z.unknown());

// ----------------------------------------------------------------------------
// Tool Use Results
// Note: originalFile and file.content are intentionally omitted (too large)
// ----------------------------------------------------------------------------

export const EditToolResultSchema = z.object({
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
  structuredPatch: z.array(PatchHunkSchema),
  userModified: z.boolean().optional(),
  replaceAll: z.boolean().optional(),
});
export type EditToolResult = z.infer<typeof EditToolResultSchema>;

export const BashToolResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  interrupted: z.boolean(),
  isImage: z.boolean().optional(),
});
export type BashToolResult = z.infer<typeof BashToolResultSchema>;

const ReadToolResultSchema = z.object({
  type: z.literal('text'),
});

const ToolUseResultMetadataSchema = z.union([
  EditToolResultSchema,
  BashToolResultSchema,
  ReadToolResultSchema,
  z.looseRecord(z.string(), z.unknown()),
  z.string(), // Error messages can be plain strings
]);

// ----------------------------------------------------------------------------
// Content Blocks (in message.content array)
// ----------------------------------------------------------------------------

export const TextContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type TextContentBlock = z.infer<typeof TextContentBlockSchema>;

export const ThinkingContentBlockSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  signature: z.string().optional(),
});
export type ThinkingContentBlock = z.infer<typeof ThinkingContentBlockSchema>;

export const ToolUseContentBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.union([
    EditToolInputSchema,
    WriteToolInputSchema,
    ReadToolInputSchema,
    BashToolInputSchema,
    GlobToolInputSchema,
    GrepToolInputSchema,
    TaskToolInputSchema,
    GenericToolInputSchema,
  ]),
});
export type ToolUseContentBlock = z.infer<typeof ToolUseContentBlockSchema>;

export const ToolResultContentBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});
export type ToolResultContentBlock = z.infer<typeof ToolResultContentBlockSchema>;

export const ContentBlockSchema = z.discriminatedUnion('type', [
  TextContentBlockSchema,
  ThinkingContentBlockSchema,
  ToolUseContentBlockSchema,
  ToolResultContentBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// ----------------------------------------------------------------------------
// Message Objects
// ----------------------------------------------------------------------------

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
  model: z.string().optional(),
  id: z.string().optional(),
  type: z.literal('message').optional(),
  stop_reason: z.enum(['end_turn', 'tool_use']).nullable().optional(),
  stop_sequence: z.string().nullable().optional(),
  usage: TokenUsageSchema.optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// ----------------------------------------------------------------------------
// Todo Items (from TodoWrite tool)
// ----------------------------------------------------------------------------

export const TodoItemSchema = z.object({
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  id: z.string().optional(),
  activeForm: z.string().optional(),
  priority: z.string().optional(),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

// ----------------------------------------------------------------------------
// Thinking Metadata
// ----------------------------------------------------------------------------

const ThinkingMetadataSchema = z.object({
  // Observed values in Claude Code session logs include "none" (in addition to
  // the more traditional "low" | "medium" | "high").
  level: z.enum(['high', 'medium', 'low', 'none']).optional(),
  disabled: z.boolean().optional(),
  triggers: z.array(z.string()).optional(),
});

// ----------------------------------------------------------------------------
// Session Entry Types
// ----------------------------------------------------------------------------

// User or Assistant message entry
const MessageEntrySchema = z.object({
  type: z.enum(['user', 'assistant']),
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  sessionId: z.string(),
  timestamp: z.string(),
  message: MessageSchema,

  // Context
  cwd: z.string(),
  version: z.string(),
  gitBranch: z.string().optional(),
  slug: z.string().optional(),

  // Threading
  isSidechain: z.boolean(),
  logicalParentUuid: z.string().optional(),

  // Agent identification
  agentId: z.string().optional(),
  userType: z.enum(['external', 'internal']).optional(),
  requestId: z.string().optional(),

  // Metadata
  thinkingMetadata: ThinkingMetadataSchema.optional(),
  toolUseResult: ToolUseResultMetadataSchema.optional(),
  todos: z.array(TodoItemSchema).optional(),
});
export type MessageEntry = z.infer<typeof MessageEntrySchema>;

// System message (e.g., context compaction)
const SystemEntrySchema = z.object({
  type: z.literal('system'),
  subtype: z.string(),
  content: z.string(),
  level: z.enum(['info', 'warning', 'error']).optional(),
  isMeta: z.boolean().optional(),
  sessionId: z.string(),
  timestamp: z.string(),
  uuid: z.string().optional(),
  logicalParentUuid: z.string().optional(),
  compactMetadata: z
    .object({
      trigger: z.enum(['auto', 'manual']),
      preTokens: z.number(),
    })
    .optional(),
});
export type SystemEntry = z.infer<typeof SystemEntrySchema>;

// Queued user input
const QueueOperationEntrySchema = z.object({
  type: z.literal('queue-operation'),
  operation: z.enum(['enqueue', 'dequeue']),
  content: z.string().optional(),
  sessionId: z.string(),
  timestamp: z.string(),
});
export type QueueOperationEntry = z.infer<typeof QueueOperationEntrySchema>;

// Session summary (conversation summary entry)
const SummaryEntrySchema = z.object({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string(),
});
export type SummaryEntry = z.infer<typeof SummaryEntrySchema>;

// File history snapshot (sessionId/timestamp may be in snapshot object instead of top level)
const FileHistorySnapshotEntrySchema = z.object({
  type: z.literal('file-history-snapshot'),
  messageId: z.string(),
  isSnapshotUpdate: z.boolean().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  snapshot: z.object({
    messageId: z.string(),
    timestamp: z.string(),
    trackedFileBackups: z.looseRecord(z.string(), z.unknown()),
  }),
});
export type FileHistorySnapshotEntry = z.infer<typeof FileHistorySnapshotEntrySchema>;

// ----------------------------------------------------------------------------
// Main Session Entry Schema (discriminated by type)
// ----------------------------------------------------------------------------

export const SessionEntrySchema = z.discriminatedUnion('type', [
  MessageEntrySchema,
  SystemEntrySchema,
  QueueOperationEntrySchema,
  FileHistorySnapshotEntrySchema,
  SummaryEntrySchema,
]);
export type SessionEntry = z.infer<typeof SessionEntrySchema>;

// ----------------------------------------------------------------------------
// Parsed Session (aggregate type for processed session files)
// ----------------------------------------------------------------------------

export interface FileEditInfo {
  /** Relative file path that was edited */
  filePath: string;
  /** Number of times this file was edited in the session */
  editCount: number;
  /** When the last backup was created */
  lastEditTime: string;
}

export interface ParsedSession {
  sessionId: string;
  slug: string | undefined;
  projectPath: string;
  filePath: string;
  gitBranch: string | undefined;
  version: string | undefined;
  entries: MessageEntry[];
  /** Conversation summaries/topics */
  summaries: string[];
  /** Files edited during this session */
  fileEdits: FileEditInfo[];
  tokenUsage: {
    input: number;
    output: number;
  };
}

export interface SessionFileInfo {
  filePath: string;
  projectPath: string;
  projectPathEncoded: string;
  mtime: Date;
}

export interface ParseError {
  filePath: string;
  line: number;
  error: string;
  raw?: string;
}
