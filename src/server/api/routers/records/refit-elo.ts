import { runEloRefit } from '@/server/services/refit-elo';
import { publicProcedure } from '../../init';

/** Refit every ELO score from the stored matchup history. */
export const refitElo = publicProcedure.mutation(() => runEloRefit());
