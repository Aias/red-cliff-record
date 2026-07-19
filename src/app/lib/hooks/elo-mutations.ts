import { trpc } from '@/app/trpc';

/**
 * Submit an ELO matchup (win/loss or draw). Invalidate participant records and
 * queries whose ordering depends on ELO scores.
 */
export function useSubmitMatchup() {
  const utils = trpc.useUtils();
  return trpc.elo.submitMatchup.useMutation({
    onSuccess: ({ results }) => {
      for (const { id } of results) {
        void utils.records.get.invalidate({ id });
      }
      void utils.records.list.invalidate();
      void utils.links.listForRecord.invalidate();
    },
  });
}
