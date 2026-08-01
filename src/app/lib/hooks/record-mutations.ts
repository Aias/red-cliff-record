import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTRPC } from '@/app/trpc';
import { removeManyFromBasket, replaceBasketId } from '@/lib/hooks/use-basket';
import { mergeRecords } from '@/shared/lib/merge-records';
import type { DbId, IdParamList } from '@/shared/types/api';
import type { RecordGet, RecordSlim } from '@/shared/types/domain';

/**
 * Drop present-but-undefined values so an optimistic spread can't clobber
 * cached fields the mutation input doesn't actually change (the server
 * filters undefined the same way before writing).
 */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export function useBulkUpdate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.records.bulkUpdate.mutationOptions({
      onMutate: ({ ids, data }) => {
        // Fire cancellations but don't await - keeps onMutate synchronous
        // to avoid race conditions with navigation
        ids.forEach((id) => void queryClient.cancelQueries(trpc.records.get.queryFilter({ id })));

        const previous = new Map<DbId, RecordGet | undefined>();
        ids.forEach((id) => {
          const cached = queryClient.getQueryData(trpc.records.get.queryKey({ id }));
          previous.set(id, cached);
          if (cached) {
            queryClient.setQueryData(trpc.records.get.queryKey({ id }), { ...cached, ...data });
          }
        });
        return { previous };
      },
      onSuccess: (ids) => {
        void queryClient.invalidateQueries(trpc.records.list.pathFilter());
        ids.forEach(
          (id) => void queryClient.invalidateQueries(trpc.records.get.queryFilter({ id }))
        );
      },
      onError: (_err, _vars, ctx) => {
        ctx?.previous.forEach((data, id) => {
          queryClient.setQueryData(trpc.records.get.queryKey({ id }), data);
        });
      },
    })
  );
}

export function useUpsertRecord() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.records.upsert.mutationOptions({
      onMutate: async (input) => {
        if (input.id === undefined) return;
        await queryClient.cancelQueries(trpc.records.get.queryFilter({ id: input.id }));
        const previous = queryClient.getQueryData(trpc.records.get.queryKey({ id: input.id }));
        if (previous) {
          const { textEmbedding: _textEmbedding, ...rest } = input;
          const changes: Partial<RecordSlim> = stripUndefined(rest);
          queryClient.setQueryData(trpc.records.get.queryKey({ id: input.id }), (p) =>
            p ? { ...p, ...changes } : p
          );
        }
        return { previous };
      },
      onSuccess: (row) => {
        /* patch point cache */
        queryClient.setQueryData(trpc.records.get.queryKey({ id: row.id }), row);

        /* refresh ID tables & search index */
        void queryClient.invalidateQueries(trpc.records.list.pathFilter());
      },
      onError: (_err, input, ctx) => {
        if (input.id !== undefined && ctx?.previous) {
          queryClient.setQueryData(trpc.records.get.queryKey({ id: input.id }), ctx.previous);
        }
      },
    })
  );
}

export function useDeleteRecords() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const removeRecordQueries = (id: DbId) => {
    queryClient.removeQueries({ queryKey: trpc.records.get.queryKey({ id }), exact: true });
    queryClient.removeQueries({ queryKey: trpc.search.byRecordId.queryKey({ id }), exact: true });
    queryClient.removeQueries({ queryKey: trpc.records.tree.queryKey({ id }), exact: true });
    queryClient.removeQueries({
      queryKey: trpc.links.listForRecord.queryKey({ id }),
      exact: true,
    });
  };

  return useMutation(
    trpc.records.delete.mutationOptions({
      onMutate: async (ids) => {
        await Promise.all(
          ids.map((id) =>
            queryClient.cancelQueries({
              queryKey: trpc.records.get.queryKey({ id }),
              exact: true,
            })
          )
        );

        // Cancel any pending mutations for these records
        queryClient.getMutationCache().clear();

        const previousRecords = new Map<DbId, RecordGet | undefined>();
        ids.forEach((id) => {
          previousRecords.set(id, queryClient.getQueryData(trpc.records.get.queryKey({ id })));
          removeRecordQueries(id);
        });

        // Optimistically remove deleted records from all record lists
        const idSet = new Set(ids);
        const entries = queryClient.getQueriesData<IdParamList>(trpc.records.list.pathFilter());
        entries.forEach(([key, data]) => {
          if (!data) return;
          queryClient.setQueryData(key, {
            ...data,
            ids: data.ids.filter(({ id }) => !idSet.has(id)),
          });
        });

        return { previousRecords, previousLists: entries };
      },
      onSuccess: (rows) => {
        removeManyFromBasket(rows.map(({ id }) => id));

        // Cleanup is already done in onMutate, just ensure consistency
        rows.forEach(({ id }) => removeRecordQueries(id));

        /* Invalidate targeted caches that might reference deleted records */
        void queryClient.invalidateQueries(trpc.records.tree.pathFilter()); // Tree queries may contain deleted records as children
        void queryClient.invalidateQueries(trpc.links.listForRecord.pathFilter()); // Link queries may reference deleted records
        void queryClient.invalidateQueries(trpc.links.map.pathFilter()); // Link maps may reference deleted records
      },
      onError: (_err, _ids, ctx) => {
        ctx?.previousRecords.forEach((data, id) => {
          queryClient.setQueryData(trpc.records.get.queryKey({ id }), data);
        });
        ctx?.previousLists.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    })
  );
}

export function useMergeRecords() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const undoMergeMutation = useUndoMerge();

  return useMutation(
    trpc.records.merge.mutationOptions({
      onMutate: ({ sourceId, targetId }) => {
        // Fire cancellations but don't await - keeps onMutate synchronous
        void queryClient.cancelQueries(trpc.records.get.queryFilter({ id: sourceId }));
        void queryClient.cancelQueries(trpc.records.get.queryFilter({ id: targetId }));

        // Snapshot the previous values
        const previousSource = queryClient.getQueryData(
          trpc.records.get.queryKey({ id: sourceId })
        );
        const previousTarget = queryClient.getQueryData(
          trpc.records.get.queryKey({ id: targetId })
        );

        // Optimistically merge the records if both exist
        if (previousSource && previousTarget) {
          const mergedData = mergeRecords(previousSource, previousTarget);
          const allMedia = Array.from(
            new Set([...(previousSource.media ?? []), ...(previousTarget.media ?? [])])
          ).map((media) => ({
            ...media,
            recordId: targetId,
          }));
          const optimisticUpdate = { ...previousTarget, ...mergedData, media: allMedia };

          // Update the target record with merged data
          queryClient.setQueryData(trpc.records.get.queryKey({ id: targetId }), optimisticUpdate);

          // Remove the source record from cache
          queryClient.setQueryData(trpc.records.get.queryKey({ id: sourceId }), () => undefined);
        }

        // Optimistically remove source record from all record lists
        const entries = queryClient.getQueriesData<IdParamList>(trpc.records.list.pathFilter());
        entries.forEach(([key, data]) => {
          if (!data) return;
          queryClient.setQueryData(key, {
            ...data,
            ids: data.ids.filter(({ id }) => id !== sourceId),
          });
        });

        return { previousSource, previousTarget, previousLists: entries };
      },
      onSuccess: ({ updatedRecord, deletedRecordId, touchedIds, snapshot }) => {
        replaceBasketId(deletedRecordId, updatedRecord.id);

        void queryClient.invalidateQueries(trpc.records.get.queryFilter({ id: updatedRecord.id }));
        void queryClient.invalidateQueries(
          trpc.search.byRecordId.queryFilter({ id: updatedRecord.id })
        );

        /* freeze the deleted ID so nothing refetches it */
        const deletedKey = trpc.records.get.queryKey({ id: deletedRecordId });

        // stop any in-flight request
        void queryClient.cancelQueries({ queryKey: deletedKey, exact: true });

        // mark as permanently gone
        queryClient.setQueryData(deletedKey, () => undefined);
        queryClient.setQueryDefaults(deletedKey, { staleTime: Infinity, retry: false });

        /* per-record link lists */
        touchedIds.forEach(
          (id) => void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id }))
        );

        /* maps that may reference the merged records */
        void queryClient.invalidateQueries(trpc.links.map.pathFilter());

        /* record-ID tables */
        void queryClient.invalidateQueries(trpc.records.list.pathFilter());
        void queryClient.invalidateQueries(trpc.records.tree.pathFilter());

        /* undo toast */
        toast('Records merged', {
          action: {
            label: 'Undo',
            onClick: () => {
              undoMergeMutation.mutate({ snapshot });
            },
          },
          duration: 15_000,
        });
      },
      onError: (_err, vars, ctx) => {
        // Revert optimistic updates
        if (ctx?.previousSource) {
          queryClient.setQueryData(
            trpc.records.get.queryKey({ id: vars.sourceId }),
            ctx.previousSource
          );
        }
        if (ctx?.previousTarget) {
          queryClient.setQueryData(
            trpc.records.get.queryKey({ id: vars.targetId }),
            ctx.previousTarget
          );
        }
        // Restore record lists
        ctx?.previousLists.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    })
  );
}

function useUndoMerge() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation(
    trpc.records.undoMerge.mutationOptions({
      onSuccess: ({ sourceRecord, targetRecord }) => {
        const sourceId = sourceRecord.id;
        const targetId = targetRecord.id;

        // Remove the staleTime: Infinity freeze on the source record
        const sourceKey = trpc.records.get.queryKey({ id: sourceId });
        queryClient.setQueryDefaults(sourceKey, { staleTime: undefined, retry: undefined });

        // Invalidate caches for both records
        void queryClient.invalidateQueries(trpc.records.get.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.records.get.queryFilter({ id: targetId }));
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: targetId }));
        void queryClient.invalidateQueries(trpc.records.list.pathFilter());
        void queryClient.invalidateQueries(trpc.records.tree.pathFilter());
        void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: targetId }));
        void queryClient.invalidateQueries(trpc.links.map.pathFilter());

        // Navigate back to the restored source record
        void navigate({
          to: '/records/$recordId',
          params: { recordId: sourceId },
        });

        toast.success('Merge undone');
      },
    })
  );
}
