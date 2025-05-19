import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { ListRecordsInput } from '@/server/api/routers/types';

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

export function useCreateMedia(id: DbId) {
	const utils = trpc.useUtils();
	return trpc.media.create.useMutation({
		onSuccess: (data) => {
			utils.records.get.setData({ id }, (prev) => {
				if (!prev) return undefined;
				return { ...prev, media: [...(prev.media ?? []), data] };
			});
		},
	});
}

export function useDeleteMedia() {
	const utils = trpc.useUtils();
	return trpc.media.delete.useMutation({
		onSuccess: (deletedMedia) => {
			for (const m of deletedMedia) {
				if (m.recordId) {
					utils.records.get.setData({ id: m.recordId }, (prev) => {
						if (!prev) return undefined;
						return {
							...prev,
							media: prev.media?.filter((p) => p.id !== m.id),
						};
					});
				}
			}
		},
	});
}

export function usePredicateMap() {
	const { data } = trpc.links.listPredicates.useQuery(undefined);
	return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}

export function usePredicateSlugMap() {
	const { data } = trpc.links.listPredicates.useQuery(undefined);
	return useMemo(() => Object.fromEntries((data ?? []).map((p) => [p.slug, p])), [data]);
}

export function useEmbedRecord() {
	const utils = trpc.useUtils();
	return trpc.records.embed.useMutation({
		onSuccess: (data) => {
			utils.records.get.setData({ id: data.id }, (prev) => {
				if (!prev) return undefined;
				return {
					...prev,
					recordUpdatedAt: data.recordUpdatedAt,
				};
			});
			utils.search.byRecordId.invalidate({ id: data.id });
		},
	});
}

export function useMarkAsCurated() {
	const utils = trpc.useUtils();

	return trpc.records.markAsCurated.useMutation({
		onSuccess: (ids) => {
			utils.records.list.invalidate();
			ids.forEach((id) => {
				utils.records.get.setData({ id }, (prev) => {
					if (!prev) return undefined;
					return { ...prev, isCurated: true };
				});
			});
		},
	});
}

export function useUpsertRecord() {
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();

	return trpc.records.upsert.useMutation({
		onSuccess: (row) => {
			/* patch point cache */
			utils.records.get.setData({ id: row.id }, row);

			/* refresh ID tables & search index */
			utils.records.list.invalidate();
			embedMutation.mutate({ id: row.id });
		},
	});
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
				qc.removeQueries({
					queryKey: utils.search.byRecordId.queryOptions({ id }).queryKey,
					exact: true,
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
	const embedMutation = useEmbedRecord();
	return trpc.records.merge.useMutation({
		onSuccess: ({ updatedRecord, deletedRecordId, touchedIds }) => {
			/* 1 ─ patch survivor */
			utils.records.get.setData({ id: updatedRecord.id }, (prev) =>
				prev ? { ...prev, ...updatedRecord } : updatedRecord
			);

			/* 2 ─ freeze the deleted ID so nothing refetches it */
			const deletedKey = utils.records.get.queryOptions({ id: deletedRecordId }).queryKey;

			// stop any in-flight request
			qc.cancelQueries({ queryKey: deletedKey, exact: true });

			// mark as permanently gone
			qc.setQueryData(deletedKey, () => undefined);
			qc.setQueryDefaults(deletedKey, { staleTime: Infinity, retry: false });

			/* 3 ─ per-record link lists */
			touchedIds.forEach((id) => utils.links.listForRecord.invalidate({ id }));

			/* 4 ─ maps that overlap */
			const touched = new Set(touchedIds);
			utils.links.map.invalidate(undefined, {
				predicate: (q) => {
					const recIds = q.queryKey[1]?.input?.recordIds as (DbId | undefined)[] | undefined;
					return !!recIds?.some((id) => touched.has(id as DbId));
				},
			});

			/* 5 ─ record-ID tables */
			utils.records.list.invalidate();
			embedMutation.mutate({ id: updatedRecord.id });
		},
	});
}

export function useUpsertLink() {
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();

	return trpc.links.upsert.useMutation({
		onMutate: ({ sourceId, targetId }) => {
			const ids = [sourceId, targetId];
			// TODO: Loop over all regardless of limit param.
			utils.search.byRecordId.setData({ id: sourceId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !ids.includes(r.id));
			});
			utils.search.byRecordId.setData({ id: targetId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !ids.includes(r.id));
			});
		},
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
			embedMutation.mutate({ id: sourceId });
			embedMutation.mutate({ id: targetId });
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
			touched.forEach((id) => {
				utils.links.listForRecord.invalidate({ id });
				utils.search.byRecordId.invalidate({ id });
			});

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
