import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { getQueryKey } from '@trpc/react-query';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import { mergeRecords } from '@/shared/lib/merge-records';
import type { DbId, IdParamList } from '@/shared/types/api';
import type { RecordGet } from '@/shared/types/domain';

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
      void utils.search.byRecordId.invalidate({ id: data.id });
    },
  });
}

export function useBulkUpdate() {
  const utils = trpc.useUtils();

  return trpc.records.bulkUpdate.useMutation({
    onMutate: ({ ids, data }) => {
      // Fire cancellations but don't await - keeps onMutate synchronous
      // to avoid race conditions with navigation
      ids.forEach((id) => void utils.records.get.cancel({ id }));

      const previous = new Map<DbId, RecordGet | undefined>();
      ids.forEach((id) => {
        const cached = utils.records.get.getData({ id });
        previous.set(id, cached);
        if (cached) {
          utils.records.get.setData({ id }, { ...cached, ...data });
        }
      });
      return { previous };
    },
    onSuccess: (ids) => {
      void utils.records.list.invalidate();
      ids.forEach((id) => void utils.records.get.invalidate({ id }));
    },
    onError: (err, _vars, ctx) => {
      ctx?.previous.forEach((data, id) => {
        utils.records.get.setData({ id }, data);
      });
      toast.error(err instanceof Error ? err.message : 'Failed to update records');
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
      void utils.records.list.invalidate();
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
      const idSet = new Set(ids);
      const removeFromLists = (queryKey: readonly unknown[]) => {
        const entries = qc.getQueriesData<IdParamList>({ queryKey });
        entries.forEach(([key, data]) => {
          if (!data) return;
          qc.setQueryData(key, { ...data, ids: data.ids.filter(({ id }) => !idSet.has(id)) });
        });
        return entries.map(([key, data]) => [key, data] as const);
      };

      const previousLists = removeFromLists(getQueryKey(trpc.records.list, undefined, 'query'));

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
      void utils.records.tree.invalidate(); // Tree queries may contain deleted records as children
      void utils.links.listForRecord.invalidate(); // Link queries may reference deleted records
      void utils.links.map.invalidate(); // Link maps may reference deleted records
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
  const undoMergeMutation = useUndoMerge();

  return trpc.records.merge.useMutation({
    onMutate: ({ sourceId, targetId }) => {
      // Fire cancellations but don't await - keeps onMutate synchronous
      void utils.records.get.cancel({ id: sourceId });
      void utils.records.get.cancel({ id: targetId });

      // Snapshot the previous values
      const previousSource = utils.records.get.getData({ id: sourceId });
      const previousTarget = utils.records.get.getData({ id: targetId });

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
        utils.records.get.setData({ id: targetId }, optimisticUpdate);

        // Remove the source record from cache
        const sourceKey = utils.records.get.queryOptions({ id: sourceId }).queryKey;
        qc.setQueryData(sourceKey, () => undefined);
      }

      // Optimistically remove source record from all record lists
      const removeFromLists = (queryKey: readonly unknown[]) => {
        const entries = qc.getQueriesData<IdParamList>({ queryKey });
        entries.forEach(([key, data]) => {
          if (!data) return;
          qc.setQueryData(key, { ...data, ids: data.ids.filter(({ id }) => id !== sourceId) });
        });
        return entries.map(([key, data]) => [key, data] as const);
      };

      const previousLists = removeFromLists(getQueryKey(trpc.records.list, undefined, 'query'));

      return { previousSource, previousTarget, previousLists };
    },
    onSuccess: ({ updatedRecord, deletedRecordId, touchedIds, snapshot }) => {
      void utils.records.get.invalidate({ id: updatedRecord.id });
      void utils.search.byRecordId.invalidate({ id: updatedRecord.id });
      void utils.records.tree.invalidate();

      /* freeze the deleted ID so nothing refetches it */
      const deletedKey = utils.records.get.queryOptions({ id: deletedRecordId }).queryKey;

      // stop any in-flight request
      void qc.cancelQueries({ queryKey: deletedKey, exact: true });

      // mark as permanently gone
      qc.setQueryData(deletedKey, () => undefined);
      qc.setQueryDefaults(deletedKey, { staleTime: Infinity, retry: false });

      /* per-record link lists */
      touchedIds.forEach((id) => void utils.links.listForRecord.invalidate({ id }));

      /* maps that overlap */
      const touched = new Set(touchedIds);
      void utils.links.map.invalidate(undefined, {
        predicate: (q) => {
          const recIds = Array.isArray(q.queryKey[1]?.input?.recordIds)
            ? q.queryKey[1].input.recordIds
            : undefined;
          return !!recIds?.some((id) => touched.has(id as DbId));
        },
      });

      /* record-ID tables */
      void utils.records.list.invalidate();
      void utils.records.tree.invalidate();

      /* re-embed the target record */
      embedMutation.mutate({ id: updatedRecord.id });

      /* undo toast */
      toast('Records merged', {
        action: {
          label: 'Undo',
          onClick: () => undoMergeMutation.mutate({ snapshot }),
        },
        duration: 15_000,
      });
    },
    onError: (err, vars, ctx) => {
      // Revert optimistic updates
      if (ctx?.previousSource) {
        utils.records.get.setData({ id: vars.sourceId }, ctx.previousSource);
      }
      if (ctx?.previousTarget) {
        utils.records.get.setData({ id: vars.targetId }, ctx.previousTarget);
      }
      // Restore record lists
      ctx?.previousLists.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      toast.error(err instanceof Error ? err.message : 'Failed to merge records');
    },
  });
}

function useUndoMerge() {
  const qc = useQueryClient();
  const utils = trpc.useUtils();
  const embedMutation = useEmbedRecord();
  const navigate = useNavigate();

  return trpc.records.undoMerge.useMutation({
    onSuccess: ({ sourceRecord, targetRecord }) => {
      const sourceId = sourceRecord.id;
      const targetId = targetRecord.id;

      // Remove the staleTime: Infinity freeze on the source record
      const sourceKey = utils.records.get.queryOptions({ id: sourceId }).queryKey;
      qc.setQueryDefaults(sourceKey, { staleTime: undefined, retry: undefined });

      // Invalidate caches for both records
      void utils.records.get.invalidate({ id: sourceId });
      void utils.records.get.invalidate({ id: targetId });
      void utils.search.byRecordId.invalidate({ id: sourceId });
      void utils.search.byRecordId.invalidate({ id: targetId });
      void utils.records.list.invalidate();
      void utils.records.tree.invalidate();
      void utils.links.listForRecord.invalidate({ id: sourceId });
      void utils.links.listForRecord.invalidate({ id: targetId });
      void utils.links.map.invalidate();

      // Re-embed both records
      embedMutation.mutate({ id: sourceId });
      embedMutation.mutate({ id: targetId });

      // Navigate back to the restored source record
      void navigate({
        to: '/records/$recordId',
        params: { recordId: sourceId },
      });

      toast.success('Merge undone');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to undo merge');
    },
  });
}
