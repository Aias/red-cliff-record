import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTRPC } from '@/app/trpc';
import { removeManyFromBasket, replaceBasketId } from '@/lib/hooks/use-basket';
import { useZeroMutate } from '@/lib/hooks/zero-mutate';
import { mutators, type BulkUpdateInput, type UpdateRecordInput } from '@/shared/zero/mutators';

/** Update fields on an existing record (optimistic via Zero). */
export function useUpdateRecord() {
  const mutate = useZeroMutate();
  return useCallback(
    (input: UpdateRecordInput) => mutate(mutators.records.update(input)),
    [mutate]
  );
}

/** Apply the same field changes to many records at once (optimistic via Zero). */
export function useBulkUpdate() {
  const mutate = useZeroMutate();
  return useCallback(
    (input: BulkUpdateInput) => mutate(mutators.records.bulkUpdate(input)),
    [mutate]
  );
}

/**
 * Create a record. Stays on tRPC because the server generates the serial id
 * and the caller needs it (to navigate or link to the new record). The row
 * arrives in the local graph through replication.
 */
export function useCreateRecord() {
  const trpc = useTRPC();
  return useMutation(trpc.records.upsert.mutationOptions());
}

/**
 * Delete records. Stays on tRPC: deletion cascades server-side (links, media,
 * R2 assets) and the removal syncs back through replication.
 */
export function useDeleteRecords() {
  const trpc = useTRPC();
  return useMutation(
    trpc.records.delete.mutationOptions({
      onSuccess: (rows) => {
        removeManyFromBasket(rows.map(({ id }) => id));
      },
    })
  );
}

/**
 * Merge two records. Stays on tRPC: the merge moves links/media, deletes the
 * source, and returns an undo snapshot; the graph updates via replication.
 */
export function useMergeRecords() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const undoMergeMutation = useUndoMerge();

  return useMutation(
    trpc.records.merge.mutationOptions({
      onSuccess: ({ updatedRecord, deletedRecordId, snapshot }) => {
        replaceBasketId(deletedRecordId, updatedRecord.id);

        // Similarity search is excluded from global invalidation.
        void queryClient.invalidateQueries(
          trpc.search.byRecordId.queryFilter({ id: updatedRecord.id })
        );

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
    })
  );
}

function useUndoMerge() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation(
    trpc.records.undoMerge.mutationOptions({
      onSuccess: ({ sourceId, targetId }) => {
        // Similarity search is excluded from global invalidation.
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: targetId }));

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
