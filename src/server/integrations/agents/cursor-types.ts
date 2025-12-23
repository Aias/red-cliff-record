import { z } from 'zod';

// ============================================================================
// Cursor IDE Chat History Schema
// Source: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
//
// Chat messages are stored in the cursorDiskKV table with keys like:
// bubbleId:{composerId}:{bubbleId}
// ============================================================================

// ----------------------------------------------------------------------------
// Bubble (Message) Schema
// ----------------------------------------------------------------------------

export const CursorBubbleSchema = z.object({
	_v: z.number().optional(),
	type: z.number(), // 1 = user, 2 = assistant
	text: z.string(),
	bubbleId: z.string(),
	isAgentic: z.boolean().optional(),
	requestId: z.string().optional(),

	// Context metadata (simplified - we don't need all fields)
	attachedCodeChunks: z.array(z.unknown()).optional(),
	suggestedCodeBlocks: z.array(z.unknown()).optional(),
	assistantSuggestedDiffs: z.array(z.unknown()).optional(),
	toolResults: z.array(z.unknown()).optional(),
	relevantFiles: z.array(z.unknown()).optional(),
	images: z.array(z.unknown()).optional(),
});
export type CursorBubble = z.infer<typeof CursorBubbleSchema>;

// ----------------------------------------------------------------------------
// Composer Metadata Schema (from composer.composerData in workspace DBs)
// ----------------------------------------------------------------------------

export const CursorComposerMetadataSchema = z.object({
	composerId: z.string(),
	name: z.string().optional(),
	lastUpdatedAt: z.number().optional(),
	createdAt: z.number().optional(),
	unifiedMode: z.string().optional(), // 'agent', 'chat', etc.
	forceMode: z.string().optional(),
	contextUsagePercent: z.number().optional(),
	totalLinesAdded: z.number().optional(),
	totalLinesRemoved: z.number().optional(),
	filesChangedCount: z.number().optional(),
	subtitle: z.string().optional(), // Files involved
	isArchived: z.boolean().optional(),
	committedToBranch: z.string().optional(),
	createdOnBranch: z.string().optional(),
});
export type CursorComposerMetadata = z.infer<typeof CursorComposerMetadataSchema>;

export const CursorComposerDataSchema = z.object({
	allComposers: z.array(
		z
			.object({
				type: z.string(),
			})
			.and(CursorComposerMetadataSchema)
	),
});
export type CursorComposerData = z.infer<typeof CursorComposerDataSchema>;

// ----------------------------------------------------------------------------
// Parsed Types
// ----------------------------------------------------------------------------

export interface CursorMessageEntry {
	bubbleId: string;
	role: 'user' | 'assistant';
	content: string;
	isAgentic?: boolean;
	requestId?: string;
}

export interface ParsedCursorSession {
	composerId: string;
	name?: string;
	createdAt?: number;
	lastUpdatedAt?: number;
	mode?: string;
	branch?: string;
	messages: CursorMessageEntry[];
	stats: {
		linesAdded?: number;
		linesRemoved?: number;
		filesChanged?: number;
	};
}

export interface CursorParseError {
	key: string;
	error: string;
	raw?: string;
}
