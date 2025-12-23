import { z } from 'zod';

// ============================================================================
// Codex CLI Session History Schema
// Source: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
//
// Each JSONL file contains one JSON object per line representing events
// in a session. Entry types are discriminated by the "type" field.
// ============================================================================

// ----------------------------------------------------------------------------
// Git Context
// ----------------------------------------------------------------------------

export const CodexGitContextSchema = z.object({
	commit_hash: z.string(),
	branch: z.string(),
	repository_url: z.string(),
});
export type CodexGitContext = z.infer<typeof CodexGitContextSchema>;

// ----------------------------------------------------------------------------
// Rate Limits (from token_count events)
// ----------------------------------------------------------------------------

export const RateLimitWindowSchema = z.object({
	used_percent: z.number(),
	window_minutes: z.number().optional(),
	resets_at: z.number().optional(),
});
export type RateLimitWindow = z.infer<typeof RateLimitWindowSchema>;

export const RateLimitsSchema = z.object({
	primary: RateLimitWindowSchema.optional(),
	secondary: RateLimitWindowSchema.optional(),
});
export type RateLimits = z.infer<typeof RateLimitsSchema>;

// ----------------------------------------------------------------------------
// Session Metadata Entry (type: "session_meta")
// ----------------------------------------------------------------------------

export const SessionMetaPayloadSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	cwd: z.string(),
	originator: z.string(),
	cli_version: z.string(),
	instructions: z.string().optional(), // System prompt - may be very large
	source: z.string(),
	model_provider: z.string().optional(),
	git: CodexGitContextSchema.optional(),
});
export type SessionMetaPayload = z.infer<typeof SessionMetaPayloadSchema>;

const SessionMetaEntrySchema = z.object({
	timestamp: z.string(),
	type: z.literal('session_meta'),
	payload: SessionMetaPayloadSchema,
});
export type SessionMetaEntry = z.infer<typeof SessionMetaEntrySchema>;

// ----------------------------------------------------------------------------
// Response Item Entry (type: "response_item")
// Lower-level API records - content blocks for messages
// ----------------------------------------------------------------------------

export const ContentItemSchema = z.object({
	type: z.string(), // "input_text", "output_text", etc.
	text: z.string().optional(),
	image_url: z.string().optional(),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ResponseItemPayloadSchema = z.object({
	type: z.string(), // "message", "reasoning", etc.
	id: z.string().optional(),
	role: z.string().optional(), // "user", "assistant", "system"
	content: z.array(ContentItemSchema).nullable().optional(),
	summary: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
	encrypted_content: z.string().optional(),
});
export type ResponseItemPayload = z.infer<typeof ResponseItemPayloadSchema>;

const ResponseItemEntrySchema = z.object({
	timestamp: z.string(),
	type: z.literal('response_item'),
	payload: ResponseItemPayloadSchema,
});
export type ResponseItemEntry = z.infer<typeof ResponseItemEntrySchema>;

// ----------------------------------------------------------------------------
// Event Message Entry (type: "event_msg")
// PRIMARY SOURCE FOR CONVERSATION - contains user/agent messages, reasoning
// ----------------------------------------------------------------------------

// User message event payload
export const UserMessageEventPayloadSchema = z.object({
	type: z.literal('user_message'),
	message: z.string(),
	images: z.array(z.unknown()).optional(),
});
export type UserMessageEventPayload = z.infer<typeof UserMessageEventPayloadSchema>;

// Agent message event payload
export const AgentMessageEventPayloadSchema = z.object({
	type: z.literal('agent_message'),
	message: z.string(),
});
export type AgentMessageEventPayload = z.infer<typeof AgentMessageEventPayloadSchema>;

// Agent reasoning event payload (like Claude's thinking)
export const AgentReasoningEventPayloadSchema = z.object({
	type: z.literal('agent_reasoning'),
	text: z.string(),
});
export type AgentReasoningEventPayload = z.infer<typeof AgentReasoningEventPayloadSchema>;

// Token count event payload
export const TokenCountEventPayloadSchema = z.object({
	type: z.literal('token_count'),
	info: z
		.object({
			total_token_usage: z
				.object({
					input_tokens: z.number(),
					output_tokens: z.number(),
					cached_input_tokens: z.number().optional(),
					reasoning_output_tokens: z.number().optional(),
					total_tokens: z.number().optional(),
				})
				.optional(),
			last_token_usage: z
				.object({
					input_tokens: z.number(),
					output_tokens: z.number(),
					cached_input_tokens: z.number().optional(),
					reasoning_output_tokens: z.number().optional(),
					total_tokens: z.number().optional(),
				})
				.optional(),
			model_context_window: z.number().optional(),
		})
		.nullable()
		.optional(),
	rate_limits: RateLimitsSchema.nullable().optional(),
});
export type TokenCountEventPayload = z.infer<typeof TokenCountEventPayloadSchema>;

// Turn aborted event payload
export const TurnAbortedEventPayloadSchema = z.object({
	type: z.literal('turn_aborted'),
	reason: z.string().optional(),
});
export type TurnAbortedEventPayload = z.infer<typeof TurnAbortedEventPayloadSchema>;

// Review mode events
export const ReviewModeEventPayloadSchema = z.object({
	type: z.enum(['entered_review_mode', 'exited_review_mode']),
});
export type ReviewModeEventPayload = z.infer<typeof ReviewModeEventPayloadSchema>;

// Generic event payload for unknown types
const GenericEventPayloadSchema = z
	.object({
		type: z.string(),
	})
	.loose();

// Combined event payload schema
export const EventMsgPayloadSchema = z.union([
	UserMessageEventPayloadSchema,
	AgentMessageEventPayloadSchema,
	AgentReasoningEventPayloadSchema,
	TokenCountEventPayloadSchema,
	TurnAbortedEventPayloadSchema,
	ReviewModeEventPayloadSchema,
	GenericEventPayloadSchema,
]);
export type EventMsgPayload = z.infer<typeof EventMsgPayloadSchema>;

const EventMsgEntrySchema = z.object({
	timestamp: z.string(),
	type: z.literal('event_msg'),
	payload: EventMsgPayloadSchema,
});
export type EventMsgEntry = z.infer<typeof EventMsgEntrySchema>;

// ----------------------------------------------------------------------------
// Turn Context Entry (type: "turn_context")
// ----------------------------------------------------------------------------

export const SandboxPolicySchema = z.object({
	mode: z.string().optional(),
	network_access: z.boolean().optional(),
	exclude_tmpdir_env_var: z.boolean().optional(),
	exclude_slash_tmp: z.boolean().optional(),
});
export type SandboxPolicy = z.infer<typeof SandboxPolicySchema>;

export const TurnContextPayloadSchema = z.object({
	cwd: z.string().optional(),
	approval_policy: z.string().optional(),
	sandbox_policy: SandboxPolicySchema.optional(),
	model: z.string().optional(),
	effort: z.string().optional(),
	summary: z.string().optional(),
});
export type TurnContextPayload = z.infer<typeof TurnContextPayloadSchema>;

const TurnContextEntrySchema = z.object({
	timestamp: z.string(),
	type: z.literal('turn_context'),
	payload: TurnContextPayloadSchema,
});
export type TurnContextEntry = z.infer<typeof TurnContextEntrySchema>;

// ----------------------------------------------------------------------------
// Main Session Entry Schema (discriminated by type)
// ----------------------------------------------------------------------------

export const CodexSessionEntrySchema = z.discriminatedUnion('type', [
	SessionMetaEntrySchema,
	ResponseItemEntrySchema,
	EventMsgEntrySchema,
	TurnContextEntrySchema,
]);
export type CodexSessionEntry = z.infer<typeof CodexSessionEntrySchema>;

// ----------------------------------------------------------------------------
// Parsed Session (aggregate type for processed session files)
// ----------------------------------------------------------------------------

export interface CodexMessageEntry {
	timestamp: string;
	role: 'user' | 'assistant';
	content: string;
}

export interface CodexReasoningEntry {
	timestamp: string;
	text: string;
}

export interface ParsedCodexSession {
	sessionId: string;
	filePath: string;
	cwd: string;
	model: string | undefined;
	cliVersion: string | undefined;
	git: CodexGitContext | undefined;
	messages: CodexMessageEntry[];
	reasoning: CodexReasoningEntry[];
	tokenUsage: {
		input: number;
		output: number;
	};
}

export interface CodexSessionFileInfo {
	filePath: string;
	mtime: Date;
}

export interface CodexParseError {
	filePath: string;
	line: number;
	error: string;
	raw?: string;
}
