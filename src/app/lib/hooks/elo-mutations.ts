import { trpc } from '@/app/trpc';

/**
 * Submit an ELO matchup (win/loss or draw). Both participants' cached records
 * are invalidated so displayed scores update; list order may have changed too.
 */
export function useSubmitMatchup() {
  const utils = trpc.useUtils();
  return trpc.elo.submitMatchup.useMutation({
    onSuccess: ({ results }) => {
      for (const { id } of results) {
        void utils.records.get.invalidate({ id });
      }
      void utils.records.list.invalidate();
    },
  });
}
