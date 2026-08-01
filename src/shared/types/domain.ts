import type { LinkSelect, MediaSelect, PredicateSlug, RecordSelect } from '@hozo';
import type { DbId } from './api';

/**
 * Core domain types used across client and server
 */

// Record row without embedding or search-index data
export type RecordSlim = Omit<RecordSelect, 'textEmbedding' | 'textSearch'>;

// records.get response: slim record enriched with API-computed data
export type RecordGet = RecordSlim & {
  matchupCount: number;
  media?: MediaSelect[];
  outgoingLinks?: Array<{
    predicate: PredicateSlug;
    target: { id: DbId; title: string | null };
  }>;
};

// Complete record with both incoming and outgoing links
export interface FullRecord extends RecordSelect {
  outgoingLinks: Array<LinkSelect & { target: RecordSlim }>;
  incomingLinks: Array<LinkSelect & { source: RecordSlim }>;
  media: Array<MediaSelect>;
}

// Partial link data for efficient operations
export type LinkPartial = Pick<
  LinkSelect,
  'id' | 'sourceId' | 'targetId' | 'predicate' | 'recordUpdatedAt'
>;

// Links for a specific record
export type RecordLinks = {
  id: DbId;
  outgoingLinks: LinkPartial[];
  incomingLinks: LinkPartial[];
};

// Map of record IDs to their links
export type RecordLinksMap = Record<DbId, RecordLinks>;
