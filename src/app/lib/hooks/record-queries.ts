import { PREDICATES, type Predicate, type PredicateSlug } from '@hozo';
import type { RecordType } from '@hozo/schema/records.shared';
import { useQuery as useZeroQuery, type useZero } from '@rocicorp/zero/react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';
import type { PoolCandidate } from '@/shared/lib/elo';
import type { DbId, ListRecordsInput } from '@/shared/types/api';
import { queries } from '@/shared/zero/queries';

/** A record row from the synced graph, with media and title-fallback edges. */
export type RecordData = NonNullable<ReturnType<typeof useRecord>['data']>;
export type RecordTreeData = NonNullable<ReturnType<typeof useRecordTree>['data']>;

export function useRecord(id: DbId) {
  const [record, details] = useZeroQuery(queries.record({ id }));
  return {
    data: record,
    isLoading: record === undefined && details.type === 'unknown',
    isError: details.type === 'error' || (record === undefined && details.type === 'complete'),
  };
}

export type RecordListInput = Omit<ListRecordsInput, 'offset'>;

/**
 * Record list backed by the synced graph. Browse mode (no search query) runs
 * entirely client-side over ZQL; search and the unsynced `hasEmbedding` filter
 * go to the server, which returns ranked ids that are then hydrated from Zero.
 */
export function useRecordList(input: RecordListInput) {
  const { searchQuery, filters, limit, orderBy } = input;
  const { sources, hasParent, hasMedia, hasEmbedding, ...zqlFilters } = filters;
  const needsServer = Boolean(searchQuery) || hasEmbedding !== undefined;
  const hasJsFilters =
    Boolean(sources?.length) || hasParent !== undefined || hasMedia !== undefined;

  const trpc = useTRPC();
  const serverList = useQuery(
    trpc.records.list.queryOptions(
      { ...input, offset: 0 },
      { enabled: needsServer, placeholderData: (prev) => prev }
    )
  );
  const serverIds = serverList.data?.ids.map((entry) => entry.id) ?? [];
  const [serverRows] = useZeroQuery(needsServer && queries.recordsByIds({ ids: serverIds }));

  const [browseRows, browseDetails] = useZeroQuery(
    !needsServer &&
      queries.browseRecords({
        ...zqlFilters,
        orderBy,
        // JS-evaluated filters run below, so the cap must come after them.
        limit: hasJsFilters ? undefined : limit,
      })
  );

  if (needsServer) {
    const byId = new Map((serverRows ?? []).map((row) => [row.id, row]));
    return {
      ids: serverIds,
      records: serverIds.flatMap((id) => byId.get(id) ?? []),
      isLoading: serverList.isLoading,
      isError: serverList.isError,
    };
  }

  let records = browseRows ?? [];
  if (hasJsFilters) {
    records = records
      .filter((row) => {
        if (sources?.length && !row.sources?.some((source) => sources.includes(source)))
          return false;
        if (hasMedia !== undefined && row.media.length > 0 !== hasMedia) return false;
        if (hasParent !== undefined) {
          const parented = row.outgoingLinks.some(
            (link) => PREDICATES[link.predicate]?.type === 'containment'
          );
          if (parented !== hasParent) return false;
        }
        return true;
      })
      .slice(0, limit);
  }
  return {
    ids: records.map((row) => row.id),
    records,
    isLoading: records.length === 0 && browseDetails.type === 'unknown',
    isError: browseDetails.type === 'error',
  };
}

export function useRecordTree(id: DbId) {
  const [tree, details] = useZeroQuery(queries.recordTree({ id }));
  return {
    data: tree,
    isLoading: tree === undefined && details.type === 'unknown',
    isError: details.type === 'error' || (tree === undefined && details.type === 'complete'),
  };
}

export function useRecordLinks(id: DbId) {
  const [record] = useZeroQuery(queries.recordLinks({ id }));
  return { data: record };
}

/** Number of ELO matchups a record has participated in. */
export function useMatchupCount(id: DbId) {
  const [matchups] = useZeroQuery(queries.recordMatchups({ id }));
  return matchups.length;
}

/**
 * Point-in-time read of the matchup pool for a type: curated records (root
 * level only, for artifacts) with per-record matchup counts, from the local
 * synced graph.
 */
export async function readEloPool(
  zero: ReturnType<typeof useZero>,
  type: RecordType
): Promise<PoolCandidate[]> {
  const [candidates, matchups] = await Promise.all([
    zero.run(queries.eloPool({ type })),
    zero.run(queries.allEloMatchups()),
  ]);
  const counts = new Map<DbId, number>();
  for (const matchup of matchups) {
    counts.set(matchup.recordAId, (counts.get(matchup.recordAId) ?? 0) + 1);
    counts.set(matchup.recordBId, (counts.get(matchup.recordBId) ?? 0) + 1);
  }
  // An artifact contained by a parent (a highlight, an excerpt) is ranked
  // through its parent; concepts and entities always stand alone.
  return candidates
    .filter((record) => record.type !== 'artifact' || record.outgoingLinks.length === 0)
    .map((record) => ({
      id: record.id,
      eloScore: record.eloScore,
      matchupCount: counts.get(record.id) ?? 0,
    }));
}

/** Returns predicates keyed by slug (static data, no network request) */
export function usePredicateMap(): Record<PredicateSlug, Predicate> {
  return PREDICATES;
}

/** The minimal edge shape needed to resolve a record's title fallbacks. */
type TitleFallbackLink = {
  predicate: PredicateSlug;
  target?: { title: string | null } | undefined;
};

/** Derive creator and parent titles from a record's outgoing links */
export function getRecordTitleFallbacks(outgoingLinks: readonly TitleFallbackLink[] | undefined) {
  let creatorTitle: string | null | undefined;
  let parentTitle: string | null | undefined;
  for (const edge of outgoingLinks ?? []) {
    const kind = PREDICATES[edge.predicate]?.type;
    if (kind === 'creation' && !creatorTitle) creatorTitle = edge.target?.title;
    if (kind === 'containment' && !parentTitle) parentTitle = edge.target?.title;
    if (creatorTitle && parentTitle) break;
  }
  return { creatorTitle, parentTitle };
}

/** Unified preview text fallback chain */
export function getRecordPreview(
  record: Pick<RecordData, 'summary' | 'content' | 'notes' | 'url'>
): string | null {
  return record.summary ?? record.content ?? record.notes ?? record.url ?? null;
}

/** Resolve the first displayable media item (first media attachment or avatar fallback) */
export function getRecordThumbnailMedia(
  record: Pick<RecordData, 'media' | 'avatarUrl'>
): { type: 'image' | 'video'; url: string; altText: string | null } | null {
  const first = record.media?.[0];
  if (first)
    return {
      type: first.type === 'video' ? 'video' : 'image',
      url: first.url,
      altText: first.altText,
    };
  if (record.avatarUrl) return { type: 'image', url: record.avatarUrl, altText: null };
  return null;
}
