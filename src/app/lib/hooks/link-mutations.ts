import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '@/app/trpc';
import { useZeroMutate } from '@/lib/hooks/zero-mutate';
import type { DbId } from '@/shared/types/api';
import { canonicalizeLink, mutators, type LinkUpsertInput } from '@/shared/zero/mutators';

/** A link's endpoints; enough to know whose embeddings/similarity it touches. */
export interface LinkEndpoints {
  id: number;
  sourceId: DbId;
  targetId: DbId;
}

/**
 * Similarity search is excluded from global invalidation but links change its
 * results (url-linked records rank as similar).
 */
function useInvalidateSimilarity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useCallback(
    (ids: Iterable<DbId>) => {
      for (const id of new Set(ids)) {
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id }));
      }
    },
    [queryClient, trpc]
  );
}

/**
 * Create or update a link (optimistic via Zero). Resolves with the canonical
 * direction the link was stored under.
 */
export function useUpsertLink() {
  const mutate = useZeroMutate();
  const invalidateSimilarity = useInvalidateSimilarity();
  return useCallback(
    async (input: LinkUpsertInput) => {
      const canonical = canonicalizeLink(input);
      await mutate(mutators.links.upsert(input));
      invalidateSimilarity([canonical.sourceId, canonical.targetId]);
      return canonical;
    },
    [mutate, invalidateSimilarity]
  );
}

/** Delete links (optimistic via Zero). */
export function useDeleteLinks() {
  const mutate = useZeroMutate();
  const invalidateSimilarity = useInvalidateSimilarity();
  return useCallback(
    async (links: LinkEndpoints[]) => {
      await mutate(
        mutators.links.delete({
          links: links.map(({ id, sourceId, targetId }) => ({ id, sourceId, targetId })),
        })
      );
      invalidateSimilarity(links.flatMap(({ sourceId, targetId }) => [sourceId, targetId]));
    },
    [mutate, invalidateSimilarity]
  );
}
