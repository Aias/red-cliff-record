import type { PredicateSelect } from '@aias/hozo';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import type { DbId, RecordLinks } from '@/shared/types';
import { useEmbedRecord } from './record-mutations';

export function useUpsertLink() {
	const utils = trpc.useUtils();
	const embedMutation = useEmbedRecord();
	const { data: predicates = [] } = trpc.links.listPredicates.useQuery();

	// Memoize predicate lookups for O(1) access
	const predicatesById = useMemo(() => {
		const map = new Map<number, PredicateSelect>();
		for (const predicate of predicates) {
			map.set(predicate.id, predicate);
		}
		return map;
	}, [predicates]);

	const predicatesBySlug = useMemo(() => {
		const map = new Map<string, PredicateSelect>();
		for (const predicate of predicates) {
			map.set(predicate.slug, predicate);
		}
		return map;
	}, [predicates]);

	return trpc.links.upsert.useMutation({
		onMutate: async ({ sourceId, targetId, predicateId, id }) => {
			// For updates, skip optimistic updates entirely - let the server handle it
			// This avoids the complexity of tracking which direction the link was originally
			// and how the server's canonicalization might change it
			if (id) {
				await Promise.all([
					utils.links.listForRecord.invalidate({ id: sourceId }),
					utils.links.listForRecord.invalidate({ id: targetId }),
				]);
				return {};
			}

			// For new links, we need to predict the server's canonicalization
			await Promise.all([
				utils.links.listForRecord.cancel({ id: sourceId }),
				utils.links.listForRecord.cancel({ id: targetId }),
			]);

			const prevSource = utils.links.listForRecord.getData({ id: sourceId });
			const prevTarget = utils.links.listForRecord.getData({ id: targetId });

			// Check if the predicate will be canonicalized by the server
			const predicate = predicatesById.get(predicateId);
			let finalSourceId = sourceId;
			let finalTargetId = targetId;
			let finalPredicateId = predicateId;

			if (predicate && !predicate.canonical) {
				// The server will flip this - mirror that behavior
				const inversePredicate = predicate.inverseSlug
					? predicatesBySlug.get(predicate.inverseSlug)
					: undefined;
				if (inversePredicate?.canonical) {
					finalSourceId = targetId;
					finalTargetId = sourceId;
					finalPredicateId = inversePredicate.id;
				}
			}

			const optimisticId = -Date.now();
			const link = {
				id: optimisticId,
				sourceId: finalSourceId,
				targetId: finalTargetId,
				predicateId: finalPredicateId,
				recordUpdatedAt: new Date(),
			};

			// Add the link to the correct arrays based on the final (canonicalized) direction
			utils.links.listForRecord.setData({ id: finalSourceId }, (data) => {
				if (!data) return data;
				return {
					...data,
					outgoingLinks: [...data.outgoingLinks, link],
				};
			});
			utils.links.listForRecord.setData({ id: finalTargetId }, (data) => {
				if (!data) return data;
				return {
					...data,
					incomingLinks: [...data.incomingLinks, link],
				};
			});

			// Use Set for O(1) lookups when filtering
			const idSet = new Set([sourceId, targetId]);
			utils.search.byRecordId.setData({ id: sourceId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !idSet.has(r.id));
			});
			utils.search.byRecordId.setData({ id: targetId, limit: 10 }, (prev) => {
				if (!prev) return undefined;
				return prev.filter((r) => !idSet.has(r.id));
			});

			return { prevSource, prevTarget };
		},
		onSuccess: (row) => {
			const { sourceId, targetId } = row;

			void utils.links.listForRecord.invalidate({ id: sourceId });
			void utils.links.listForRecord.invalidate({ id: targetId });

			void utils.records.tree.invalidate({ id: sourceId });
			void utils.records.tree.invalidate({ id: targetId });

			void utils.links.map.invalidate(undefined, {
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
				void utils.links.listForRecord.invalidate({ id });
				void utils.records.tree.invalidate({ id });
				void utils.search.byRecordId.invalidate({ id });
			});

			/* 2 ▸ drop any cached map that overlaps the touched set */
			void utils.links.map.invalidate(undefined, {
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
