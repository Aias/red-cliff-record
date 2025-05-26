import { useQueries } from '@tanstack/react-query';
import { trpc } from '@/app/trpc';
import type { ListRecordsInput } from '@/shared/types';
import type { DbId } from '@/shared/types';

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

export function useRecordWithOutgoingLinks(id: DbId) {
	/* 1 ▸ main record */
	const { data: record, ...recordRest } = trpc.records.get.useQuery({ id });

	/* 2 ▸ link metadata – fire immediately */
	const { data: linksData, ...linksRest } = trpc.links.listForRecord.useQuery({ id });

	/* 3 ▸ linked records */
	const linkIds = linksData?.outgoingLinks.map((l) => l.targetId) ?? [];

	const utils = trpc.useUtils();
	const linkedQueries = useQueries({
		queries: linkIds.map((rid) => utils.records.get.queryOptions({ id: rid })),
	});

	const linkedById = Object.fromEntries(
		linkedQueries.filter((q) => q.data).map((q) => [q.data!.id, q.data!])
	);

	return {
		record,
		linkedById,
		outgoing: linksData?.outgoingLinks ?? [],
		isLoading: recordRest.isLoading || linksRest.isLoading,
		isError: recordRest.isError || linksRest.isError,
	};
}

export function usePredicateMap() {
	const { data } = trpc.links.listPredicates.useQuery(undefined);
	return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}
