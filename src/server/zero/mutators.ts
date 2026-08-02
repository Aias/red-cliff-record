import './db';
import { eloMatchups, links } from '@hozo';
import { defineMutator, defineMutators } from '@rocicorp/zero';
import { eq } from 'drizzle-orm';
import { SubmitMatchupInputSchema, type DbId } from '@/shared/types/api';
import {
  applyMatchupScores,
  canonicalizeLink,
  LinkUpsertSchema,
  mutators,
} from '@/shared/zero/mutators';

/**
 * Server registry: the shared mutators, with overrides for the two mutators
 * that insert into serial-keyed tables (the client inserts placeholder ids;
 * the server lets Postgres assign the real ones).
 */
export const serverMutators = defineMutators(mutators, {
  links: {
    upsert: defineMutator(LinkUpsertSchema, async ({ tx, ctx, args }) => {
      if (tx.location !== 'server') throw new Error('Server-only mutator');
      const dtx = tx.dbTransaction.wrappedTransaction;

      const { sourceId, targetId, predicate } = canonicalizeLink(args);
      if (sourceId === targetId) throw new Error('sourceId and targetId cannot be identical');

      const linkData = {
        sourceId,
        targetId,
        predicate,
        notes: args.notes ?? null,
        recordUpdatedAt: new Date(),
      };

      /* Endpoints of the pre-update row: retargeting a link leaves the old
       * endpoints' embedding text stale, so they regenerate alongside the new. */
      let previousEndpointIds: DbId[] = [];

      if (args.id !== undefined) {
        const previous = await dtx.query.links.findFirst({
          where: { id: args.id },
          columns: { sourceId: true, targetId: true },
        });
        if (previous) previousEndpointIds = [previous.sourceId, previous.targetId];
        const [row] = await dtx
          .update(links)
          .set(linkData)
          .where(eq(links.id, args.id))
          .returning();
        if (!row) throw new Error('Link not found for update');
      } else {
        await dtx
          .insert(links)
          .values(linkData)
          .onConflictDoUpdate({
            target: [links.sourceId, links.targetId, links.predicate],
            set: linkData,
          });
      }

      ctx?.queueEmbeddings([sourceId, targetId, ...previousEndpointIds]);
    }),
  },
  elo: {
    submitMatchup: defineMutator(SubmitMatchupInputSchema, async ({ tx, args }) => {
      if (tx.location !== 'server') throw new Error('Server-only mutator');
      const { aId, bId, winnerId, recordType } = await applyMatchupScores(tx, args);
      await tx.dbTransaction.wrappedTransaction
        .insert(eloMatchups)
        .values({ recordAId: aId, recordBId: bId, winnerId, recordType });
    }),
  },
});
