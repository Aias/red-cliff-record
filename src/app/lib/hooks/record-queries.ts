import { PREDICATES, type Predicate, type PredicateSlug } from '@hozo';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';
import type { DbId, ListRecordsInput } from '@/shared/types/api';
import type { RecordGet } from '@/shared/types/domain';

export function useRecord(id: DbId) {
  const trpc = useTRPC();
  return useQuery(trpc.records.get.queryOptions({ id }));
}

export function useRecordList(args: ListRecordsInput) {
  const trpc = useTRPC();
  const { data, ...rest } = useQuery(trpc.records.list.queryOptions(args));

  const ids = data?.ids.map((id) => id.id) ?? [];

  const recordQueries = useQueries({
    queries: ids.map((id) => trpc.records.get.queryOptions({ id })),
  });

  const records = recordQueries.map((q) => q.data).filter((r) => r !== undefined);

  return { ...rest, records };
}

export function useRecordTree(id: DbId) {
  const trpc = useTRPC();
  return useQuery(
    trpc.records.tree.queryOptions({ id }, { placeholderData: (previousData) => previousData })
  );
}

export function useRecordLinks(id: DbId) {
  const trpc = useTRPC();
  return useQuery(trpc.links.listForRecord.queryOptions({ id }));
}

export function useLinksMap(ids: DbId[]) {
  const trpc = useTRPC();
  return useQuery(trpc.links.map.queryOptions({ recordIds: ids }));
}

/** Returns predicates keyed by slug (static data, no network request) */
export function usePredicateMap(): Record<PredicateSlug, Predicate> {
  return PREDICATES;
}

/** Derive creator and parent titles from a record's outgoing links */
export function getRecordTitleFallbacks(outgoingLinks: RecordGet['outgoingLinks']) {
  let creatorTitle: string | null | undefined;
  let parentTitle: string | null | undefined;
  for (const edge of outgoingLinks ?? []) {
    const kind = PREDICATES[edge.predicate]?.type;
    if (kind === 'creation' && !creatorTitle) creatorTitle = edge.target.title;
    if (kind === 'containment' && !parentTitle) parentTitle = edge.target.title;
    if (creatorTitle && parentTitle) break;
  }
  return { creatorTitle, parentTitle };
}

/** Unified preview text fallback chain */
export function getRecordPreview(
  record: Pick<RecordGet, 'summary' | 'content' | 'notes' | 'url'>
): string | null {
  return record.summary ?? record.content ?? record.notes ?? record.url ?? null;
}

/** Resolve the first displayable media item (first media attachment or avatar fallback) */
export function getRecordThumbnailMedia(
  record: Pick<RecordGet, 'media' | 'avatarUrl'>
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
