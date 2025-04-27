import { useQueries, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { ListRecordsInput } from '@/server/api/routers/records.types';

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

export function useRecordLinks(id: DbId) {
	return trpc.links.listForRecord.useQuery({ id });
}

export function useLinksMap(ids: DbId[]) {
	return trpc.links.map.useQuery({ recordIds: ids });
}

export function usePredicateMap() {
	const { data } = trpc.links.listPredicates.useQuery(undefined);
	return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}

export function useUpsertRecord() {
	const utils = trpc.useUtils();

	return trpc.records.upsert.useMutation({
		onSuccess: (row) => {
			/* patch point cache */
			utils.records.get.setData({ id: row.id }, row);

			/* refresh ID tables & search index */
			utils.records.list.invalidate();
			utils.records.searchByRecordId.invalidate({ id: row.id });
		},
	});
}

function isIdInput(v: unknown): v is { input?: { id?: DbId } } {
	return typeof v === 'object' && v !== null && 'input' in v;
}

export function useDeleteRecords() {
	const qc = useQueryClient();
	const utils = trpc.useUtils();

	return trpc.records.delete.useMutation({
		onSuccess: (rows) => {
			rows.forEach(({ id }) => {
				/* 1 ▸ remove point-query cache completely */
				qc.removeQueries({
					queryKey: utils.records.get.queryOptions({ id }).queryKey,
					exact: true,
				});

				/* 2 ▸ drop any cached search entry for this ID */
				utils.records.searchByRecordId.invalidate(undefined, {
					predicate: (q) => isIdInput(q.queryKey[1]) && q.queryKey[1].input?.id === id,
				});
			});

			/* 3 ▸ refetch record lists (IDs only) */
			utils.records.list.invalidate();
		},
	});
}

export function useMergeRecords() {
	const qc = useQueryClient();
	const utils = trpc.useUtils();

	return trpc.records.merge.useMutation({
		onSuccess: ({ updatedRecord, deletedRecordId, touchedIds }) => {
			/* survivor */
			utils.records.get.setData({ id: updatedRecord.id }, (prev) => {
				if (!prev) return updatedRecord;
				return { ...prev, ...updatedRecord };
			});

			/* purge deleted */
			qc.removeQueries({
				queryKey: utils.records.get.queryOptions({ id: deletedRecordId }).queryKey,
				exact: true,
			});

			/* per-record link lists */
			touchedIds.forEach((id) => utils.links.listForRecord.invalidate({ id }));

			/* any cached maps that overlap */
			const touchedSet = new Set(touchedIds);
			utils.links.map.invalidate(undefined, {
				predicate: (q) => {
					const input = q.queryKey[1]?.input;
					if (!input?.recordIds) return false;
					const ids = input.recordIds.filter((n): n is DbId => n !== undefined);
					return ids.some((id) => touchedSet.has(id));
				},
			});

			/* record ID tables */
			utils.records.list.invalidate();
		},
	});
}

export function useUpsertLink() {
	const utils = trpc.useUtils();

	return trpc.links.upsert.useMutation({
		onSuccess: (row) => {
			const { sourceId, targetId } = row;

			utils.links.listForRecord.invalidate({ id: sourceId });
			utils.links.listForRecord.invalidate({ id: targetId });

			utils.links.map.invalidate(undefined, {
				predicate: (q) => {
					const input = q.queryKey[1]?.input;

					if (!input?.recordIds) return false;

					const ids = input.recordIds.filter((n): n is DbId => n !== undefined);

					return ids.includes(sourceId) || ids.includes(targetId);
				},
			});
		},
	});
}

export function useDeleteLinks() {
	const utils = trpc.useUtils();

	return trpc.links.delete.useMutation({
		onSuccess: (rows) => {
			/* collect every record whose link list changed */
			const touched = new Set<DbId>();
			rows.forEach(({ sourceId, targetId }) => {
				touched.add(sourceId);
				touched.add(targetId);
			});

			/* 1 ▸ invalidate per-record link lists */
			touched.forEach((id) => utils.links.listForRecord.invalidate({ id }));

			/* 2 ▸ drop any cached map that overlaps the touched set */
			utils.links.map.invalidate(undefined, {
				predicate: (q) => {
					const input = q.queryKey[1]?.input;
					if (!input?.recordIds) return false;

					const ids = input.recordIds.filter((n): n is DbId => n !== undefined);
					return ids.some((id) => touched.has(id));
				},
			});
		},
	});
}
