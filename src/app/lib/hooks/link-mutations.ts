import { getInverse, PREDICATES, type PredicateSlug } from '@hozo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';
import type { DbId } from '@/shared/types/api';
import type { RecordLinks } from '@/shared/types/domain';

/** Placeholder ids for optimistic links; negative so they never collide with db ids. */
let nextOptimisticLinkId = -1;

export function useUpsertLink() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.links.upsert.mutationOptions({
      onMutate: async ({ sourceId, targetId, predicate, id }) => {
        // For updates, skip optimistic updates entirely - let the server handle it
        // This avoids the complexity of tracking which direction the link was originally
        // and how the server's canonicalization might change it
        if (id) {
          await Promise.all([
            queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: sourceId })),
            queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: targetId })),
          ]);
          return {};
        }

        // For new links, we need to predict the server's canonicalization
        await Promise.all([
          queryClient.cancelQueries(trpc.links.listForRecord.queryFilter({ id: sourceId })),
          queryClient.cancelQueries(trpc.links.listForRecord.queryFilter({ id: targetId })),
        ]);

        const prevSource = queryClient.getQueryData(
          trpc.links.listForRecord.queryKey({ id: sourceId })
        );
        const prevTarget = queryClient.getQueryData(
          trpc.links.listForRecord.queryKey({ id: targetId })
        );

        // Check if the predicate will be canonicalized by the server
        const predicateDef = PREDICATES[predicate];
        let finalSourceId = sourceId;
        let finalTargetId = targetId;
        let finalPredicate: PredicateSlug = predicate;

        if (!predicateDef.canonical) {
          // The server will flip this - mirror that behavior
          const inversePredicate = getInverse(predicate);
          if (inversePredicate.canonical) {
            finalSourceId = targetId;
            finalTargetId = sourceId;
            finalPredicate = inversePredicate.slug as PredicateSlug;
          }
        }

        const link = {
          id: nextOptimisticLinkId--,
          sourceId: finalSourceId,
          targetId: finalTargetId,
          predicate: finalPredicate,
          recordUpdatedAt: new Date(),
        };

        // Add the link to the correct arrays based on the final (canonicalized) direction
        queryClient.setQueryData(
          trpc.links.listForRecord.queryKey({ id: finalSourceId }),
          (data) => {
            if (!data) return data;
            return {
              ...data,
              outgoingLinks: [...data.outgoingLinks, link],
            };
          }
        );
        queryClient.setQueryData(
          trpc.links.listForRecord.queryKey({ id: finalTargetId }),
          (data) => {
            if (!data) return data;
            return {
              ...data,
              incomingLinks: [...data.incomingLinks, link],
            };
          }
        );

        return { prevSource, prevTarget };
      },
      onSuccess: (row) => {
        const { sourceId, targetId } = row;

        void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id: targetId }));

        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id: targetId }));

        void queryClient.invalidateQueries(trpc.records.tree.queryFilter({ id: sourceId }));
        void queryClient.invalidateQueries(trpc.records.tree.queryFilter({ id: targetId }));

        void queryClient.invalidateQueries(trpc.links.map.pathFilter());
      },
      onError: (_err, variables, ctx) => {
        if (ctx?.prevSource) {
          queryClient.setQueryData(
            trpc.links.listForRecord.queryKey({ id: variables.sourceId }),
            ctx.prevSource
          );
        }
        if (ctx?.prevTarget) {
          queryClient.setQueryData(
            trpc.links.listForRecord.queryKey({ id: variables.targetId }),
            ctx.prevTarget
          );
        }
      },
    })
  );
}

export function useDeleteLinks() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.links.delete.mutationOptions({
      onMutate: (ids) => {
        const entries = queryClient.getQueriesData<RecordLinks>(
          trpc.links.listForRecord.pathFilter()
        );
        const previous = entries.map(([key, data]) => [key, data] as const);
        const idSet = new Set(ids);
        entries.forEach(([key, data]) => {
          if (!data) return;
          queryClient.setQueryData(key, {
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
          void queryClient.invalidateQueries(trpc.links.listForRecord.queryFilter({ id }));
          void queryClient.invalidateQueries(trpc.records.tree.queryFilter({ id }));
          void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id }));
        });

        /* 2 ▸ drop any cached map that may reference the deleted links */
        void queryClient.invalidateQueries(trpc.links.map.pathFilter());
      },
      onError: (_err, _ids, ctx) => {
        ctx?.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    })
  );
}
