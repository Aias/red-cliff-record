import { PREDICATES, type Predicate, type PredicateSlug } from '@hozo';
import { useQueries } from '@tanstack/react-query';
import { trpc } from '@/app/trpc';
import type { DbId, ListRecordsInput } from '@/shared/types/api';
import type { RecordGet } from '@/shared/types/domain';

export function useRecord(id: DbId) {
  return trpc.records.get.useQuery({ id });
}

export const useRecordSuspense = (id: DbId) => {
  return trpc.records.get.useSuspenseQuery({ id });
};

export function useRecordList(args: ListRecordsInput) {
  const { data, ...rest } = trpc.records.list.useQuery(args);

  const ids = data?.ids.map((id) => id.id) ?? [];

  const utils = trpc.useUtils();

  const recordQueries = useQueries({
    queries: ids.map((id) => utils.records.get.queryOptions({ id })),
  });

  const records = recordQueries.map((q) => q.data).filter((r) => r !== undefined);

  return { ...rest, records };
}

export function useRecordTree(id: DbId) {
  return trpc.records.tree.useQuery({ id }, { placeholderData: (previousData) => previousData });
}

export function useRecordLinks(id: DbId) {
  return trpc.links.listForRecord.useQuery({ id });
}

export function useLinksMap(ids: DbId[]) {
  return trpc.links.map.useQuery({ recordIds: ids });
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
