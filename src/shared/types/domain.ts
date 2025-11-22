import type { DbId } from './api';
import type { LinkSelect, MediaSelect, PredicateSelect, RecordSelect } from './database';

/**
 * Core domain types used across client and server
 */

// Record without embedding data (for client consumption)
export type RecordGet = Omit<RecordSelect & { media?: MediaSelect[] }, 'textEmbedding'> & {
	outgoingLinks?: Array<{
		predicate: Pick<PredicateSelect, 'type'>;
		target: { id: DbId; title: string | null };
	}>;
};

// Complete record with both incoming and outgoing links
export interface FullRecord extends RecordSelect {
	outgoingLinks: Array<LinkSelect & { target: RecordGet; predicate: PredicateSelect }>;
	incomingLinks: Array<LinkSelect & { source: RecordGet; predicate: PredicateSelect }>;
	media: Array<MediaSelect>;
}

// Partial link data for efficient operations
export type LinkPartial = Pick<LinkSelect, 'id' | 'sourceId' | 'targetId' | 'predicateId'>;

// Links for a specific record
export type RecordLinks = {
	id: DbId;
	outgoingLinks: LinkPartial[];
	incomingLinks: LinkPartial[];
};

// Map of record IDs to their links
export type RecordLinksMap = Record<DbId, RecordLinks>;
