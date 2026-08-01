import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';

/**
 * Submit an ELO matchup (win/loss or draw). Patch the participants' cached
 * records from the authoritative response, and invalidate queries whose
 * ordering depends on ELO scores.
 */
export function useSubmitMatchup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.elo.submitMatchup.mutationOptions({
      onSuccess: ({ results }) => {
        for (const { id, eloScore, matchupCount } of results) {
          queryClient.setQueryData(trpc.records.get.queryKey({ id }), (prev) =>
            prev ? { ...prev, eloScore, matchupCount } : prev
          );
        }
        void queryClient.invalidateQueries(trpc.records.list.pathFilter());
        void queryClient.invalidateQueries(trpc.links.listForRecord.pathFilter());
      },
    })
  );
}
