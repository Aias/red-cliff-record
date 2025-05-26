import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { RecordLinks } from '@/server/api/routers/types';
import { useEmbedRecord } from './record-mutations';

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
