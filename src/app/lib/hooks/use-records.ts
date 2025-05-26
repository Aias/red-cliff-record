import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import type { DbId, IdParamList } from '@/server/api/routers/common';
import type { ListRecordsInput, RecordGet, RecordLinks } from '@/server/api/routers/types';
import { mergeRecords } from '@/lib/merge-records';

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
		onMutate: async ({ ids }) => {
			await Promise.all(ids.map((id) => utils.records.get.cancel({ id })));
			const previous = new Map<DbId, RecordGet | undefined>();
			ids.forEach((id) => {
				const data = utils.records.get.getData({ id });
				previous.set(id, data);
				if (data) {
					utils.records.get.setData({ id }, { ...data, isCurated: true });
				}
			});
			return { previous };
		},
		onSuccess: (ids) => {
			utils.records.list.invalidate();
			ids.forEach((id) => {
				utils.records.get.setData({ id }, (prev) => {
					if (!prev) return undefined;
					return { ...prev, isCurated: true };
				});
			});
		},
		onError: (err, _vars, ctx) => {
			ctx?.previous.forEach((data, id) => {
				utils.records.get.setData({ id }, data);
			});
			toast.error(err instanceof Error ? err.message : 'Failed to mark as curated');
		},
	});
}

export function useUpsertRecord() {
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();

	return trpc.records.upsert.useMutation({
		onMutate: async (input) => {
			if (input.id === undefined) return;
			await utils.records.get.cancel({ id: input.id });
			const previous = utils.records.get.getData({ id: input.id });
			if (previous) {
				const changes = input as Partial<RecordGet>;
				utils.records.get.setData({ id: input.id }, (p) => (p ? { ...p, ...changes } : p));
			}
			return { previous };
		},
		onSuccess: (row) => {
			/* patch point cache */
			utils.records.get.setData({ id: row.id }, row);

			/* refresh ID tables & search index */
			utils.records.list.invalidate();
			embedMutation.mutate({ id: row.id });
		},
		onError: (err, input, ctx) => {
			if (input.id !== undefined && ctx?.previous) {
				utils.records.get.setData({ id: input.id }, ctx.previous);
			}
			toast.error(err instanceof Error ? err.message : 'Failed to update record');
		},
	});
}

export function useDeleteRecords() {
	const qc = useQueryClient();
	const utils = trpc.useUtils();

	return trpc.records.delete.useMutation({
		onMutate: async (ids) => {
			await Promise.all(
				ids.map((id) =>
					qc.cancelQueries({
						queryKey: utils.records.get.queryOptions({ id }).queryKey,
						exact: true,
					})
				)
			);

			// Cancel any pending mutations for these records
			qc.getMutationCache().clear();

			const previousRecords = new Map<DbId, RecordGet | undefined>();
			ids.forEach((id) => {
				const data = qc.getQueryData(utils.records.get.queryOptions({ id }).queryKey);
				previousRecords.set(id, data);
				qc.removeQueries({
					queryKey: utils.records.get.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.search.byRecordId.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.records.tree.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.links.listForRecord.queryOptions({ id }).queryKey,
					exact: true,
				});
			});

			// Optimistically remove deleted records from all record lists
			const listEntries = qc.getQueriesData<IdParamList>({ queryKey: ['records', 'list'] });
			const previousLists = listEntries.map(([key, data]) => [key, data] as const);
			const idSet = new Set(ids);
			listEntries.forEach(([key, data]) => {
				if (!data) return;
				qc.setQueryData(key, {
					...data,
					ids: data.ids.filter(({ id }) => !idSet.has(id)),
				});
			});

			return { previousRecords, previousLists };
		},
		onSuccess: (rows) => {
			// Cleanup is already done in onMutate, just ensure consistency
			rows.forEach(({ id }) => {
				qc.removeQueries({
					queryKey: utils.records.get.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.search.byRecordId.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.records.tree.queryOptions({ id }).queryKey,
					exact: true,
				});
				qc.removeQueries({
					queryKey: utils.links.listForRecord.queryOptions({ id }).queryKey,
					exact: true,
				});
			});

			/* Invalidate targeted caches that might reference deleted records */
			utils.records.tree.invalidate(); // Tree queries may contain deleted records as children
			utils.links.listForRecord.invalidate(); // Link queries may reference deleted records
			utils.links.map.invalidate(); // Link maps may reference deleted records
		},
		onError: (err, _ids, ctx) => {
			ctx?.previousRecords.forEach((data, id) => {
				qc.setQueryData(utils.records.get.queryOptions({ id }).queryKey, data);
			});
			ctx?.previousLists.forEach(([key, data]) => {
				qc.setQueryData(key, data);
			});
			toast.error(err instanceof Error ? err.message : 'Failed to delete records');
		},
	});
}

export function useMergeRecords() {
	const qc = useQueryClient();
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();
	return trpc.records.merge.useMutation({
		onMutate: async ({ sourceId, targetId }) => {
			// Cancel any outgoing refetches for these records
			await Promise.all([
				utils.records.get.cancel({ id: sourceId }),
				utils.records.get.cancel({ id: targetId }),
			]);

			// Snapshot the previous values
			const previousSource = utils.records.get.getData({ id: sourceId });
			const previousTarget = utils.records.get.getData({ id: targetId });

			// Optimistically merge the records if both exist
			if (previousSource && previousTarget) {
				const mergedData = mergeRecords(previousSource, previousTarget);
				const optimisticUpdate = { ...previousTarget, ...mergedData };

				// Update the target record with merged data
				utils.records.get.setData({ id: targetId }, optimisticUpdate);

				// Remove the source record from cache
				const sourceKey = utils.records.get.queryOptions({ id: sourceId }).queryKey;
				qc.setQueryData(sourceKey, () => undefined);
			}

			return { previousSource, previousTarget };
		},
		onSuccess: ({ updatedRecord, deletedRecordId, touchedIds }) => {
			/* 1 ─ patch survivor with real data */
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
					const recIds = Array.isArray(q.queryKey[1]?.input?.recordIds)
						? q.queryKey[1].input.recordIds
						: undefined;
					return !!recIds?.some((id) => touched.has(id as DbId));
				},
			});

			/* 5 ─ record-ID tables */
			utils.records.list.invalidate();
			embedMutation.mutate({ id: updatedRecord.id });
		},
		onError: (err, vars, ctx) => {
			// Revert optimistic updates
			if (ctx?.previousSource) {
				utils.records.get.setData({ id: vars.sourceId }, ctx.previousSource);
			}
			if (ctx?.previousTarget) {
				utils.records.get.setData({ id: vars.targetId }, ctx.previousTarget);
			}
			toast.error(err instanceof Error ? err.message : 'Failed to merge records');
		},
	});
}

export function useUpsertLink() {
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();

	return trpc.links.upsert.useMutation({
		onMutate: async ({ sourceId, targetId, predicateId, id }) => {
			await Promise.all([
				utils.links.listForRecord.cancel({ id: sourceId }),
				utils.links.listForRecord.cancel({ id: targetId }),
			]);

			const prevSource = utils.links.listForRecord.getData({ id: sourceId });
			const prevTarget = utils.links.listForRecord.getData({ id: targetId });

			const optimisticId = id ?? -Date.now();
			const link = { id: optimisticId, sourceId, targetId, predicateId } as const;

			utils.links.listForRecord.setData({ id: sourceId }, (data) => {
				if (!data) return data;
				return {
					...data,
					outgoingLinks: [...data.outgoingLinks.filter((l) => l.id !== id), link],
				};
			});
			utils.links.listForRecord.setData({ id: targetId }, (data) => {
				if (!data) return data;
				return {
					...data,
					incomingLinks: [...data.incomingLinks.filter((l) => l.id !== id), link],
				};
			});

			const ids = [sourceId, targetId];
			utils.search.byRecordId.setData({ id: sourceId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !ids.includes(r.id));
			});
			utils.search.byRecordId.setData({ id: targetId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !ids.includes(r.id));
			});

			return { prevSource, prevTarget };
		},
		onSuccess: (row) => {
			const { sourceId, targetId } = row;

			utils.links.listForRecord.invalidate({ id: sourceId });
			utils.links.listForRecord.invalidate({ id: targetId });

			utils.records.tree.invalidate({ id: sourceId });
			utils.records.tree.invalidate({ id: targetId });

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
		onError: (err, variables, ctx) => {
			if (ctx?.prevSource) {
				utils.links.listForRecord.setData({ id: variables.sourceId }, ctx.prevSource);
			}
			if (ctx?.prevTarget) {
				utils.links.listForRecord.setData({ id: variables.targetId }, ctx.prevTarget);
			}
			toast.error(err instanceof Error ? err.message : 'Failed to upsert link');
		},
	});
}

export function useDeleteLinks() {
	const utils = trpc.useUtils();
	const qc = useQueryClient();

	return trpc.links.delete.useMutation({
		onMutate: (ids) => {
			const entries = qc.getQueriesData<RecordLinks>({
				queryKey: ['links', 'listForRecord'],
			});
			const previous = entries.map(([key, data]) => [key, data] as const);
			const idSet = new Set(ids);
			entries.forEach(([key, data]) => {
				if (!data) return;
				qc.setQueryData(key, {
					...data,
					outgoingLinks: data.outgoingLinks.filter((l) => !idSet.has(l.id)),
					incomingLinks: data.incomingLinks.filter((l) => !idSet.has(l.id)),
				});
			});
			return { previous };
		},
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
				utils.records.tree.invalidate({ id });
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
		onError: (err, _ids, ctx) => {
			ctx?.previous.forEach(([key, data]) => {
				qc.setQueryData(key, data);
			});
			toast.error(err instanceof Error ? err.message : 'Failed to delete links');
		},
	});
}
