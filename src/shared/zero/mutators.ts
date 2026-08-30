import { LinkInsertSchema, PREDICATES, type PredicateSlug } from '@hozo';
import { RecordTypeSchema } from '@hozo/schema/records.shared';
import { defineMutator, defineMutators, type Transaction } from '@rocicorp/zero';
import { z } from 'zod';
import { eloDeltas } from '@/shared/lib/elo';
import {
  IdSchema,
  SubmitMatchupInputSchema,
  UndoMatchupInputSchema,
  type DbId,
} from '@/shared/types/api';
import type { ZeroAppContext } from './context';
import { zql } from './schema.gen';

/**
 * Placeholder ids for client-side inserts into serial-keyed tables; negative
 * so they never collide with db ids. The server mutator inserts the real row
 * with a database-generated id and the optimistic row is dropped on rebase.
 */
let nextClientInsertId = -1;
const tempId = () => nextClientInsertId--;

/**
 * Mark records' embeddings stale and schedule their regeneration.
 *
 * Clearing `textEmbeddedAt` is what tells clients a regeneration is in flight,
 * so it happens here rather than at each call site: the mark and the work it
 * describes cannot drift apart. The vector itself survives, so similarity
 * search keeps serving the previous results until the new one lands.
 */
export async function queueEmbeddings(
  tx: Transaction,
  ctx: ZeroAppContext | undefined,
  ids: DbId[]
): Promise<void> {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    await tx.mutate.records.update({ id, textEmbeddedAt: null });
  }
  ctx?.regenerateEmbeddings(unique);
}

async function curatedAtForUpdate(
  tx: Transaction,
  id: DbId,
  isCurated: boolean | undefined
): Promise<{ recordCuratedAt?: number | null }> {
  if (isCurated === undefined) return {};
  if (!isCurated) return { recordCuratedAt: null };
  const existing = await tx.run(zql.records.where('id', id).one());
  return { recordCuratedAt: existing?.recordCuratedAt ?? Date.now() };
}

export const RecordUpdateFieldsSchema = z.object({
  type: RecordTypeSchema.optional(),
  title: z.string().nullable().optional(),
  abbreviation: z.string().nullable().optional(),
  sense: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  mediaCaption: z.string().nullable().optional(),
  isCurated: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});

export const UpdateRecordSchema = RecordUpdateFieldsSchema.extend({ id: IdSchema });
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>;

export const BulkUpdateSchema = z.object({
  ids: z.array(IdSchema),
  data: RecordUpdateFieldsSchema,
});
export type BulkUpdateInput = z.infer<typeof BulkUpdateSchema>;

export const LinkUpsertSchema = z.object({
  id: IdSchema.optional(),
  sourceId: IdSchema,
  targetId: IdSchema,
  predicate: LinkInsertSchema.shape.predicate,
  notes: z.string().nullable().optional(),
});
export type LinkUpsertInput = z.infer<typeof LinkUpsertSchema>;

export const DeleteLinksSchema = z.object({
  links: z.array(z.object({ id: z.number().int(), sourceId: IdSchema, targetId: IdSchema })),
});

/**
 * Compute the canonical stored direction for a link. Non-canonical predicates
 * are flipped to their canonical inverse (`creator_of` becomes `created_by`
 * with source/target swapped).
 */
export function canonicalizeLink(input: {
  sourceId: DbId;
  targetId: DbId;
  predicate: PredicateSlug;
}): { sourceId: DbId; targetId: DbId; predicate: PredicateSlug } {
  const { sourceId, targetId, predicate } = input;
  const def = PREDICATES[predicate];
  if (def.canonical) return { sourceId, targetId, predicate };
  const inverseSlug = def.inverseSlug;
  if (!PREDICATES[inverseSlug].canonical) {
    throw new Error('Non-canonical predicate is not reversible');
  }
  return { sourceId: targetId, targetId: sourceId, predicate: inverseSlug };
}

export type SubmitMatchupInput = z.infer<typeof SubmitMatchupInputSchema>;

/**
 * Validate a matchup and apply the ELO score updates to both records.
 * Shared between the client mutator (optimistic) and the server override,
 * which each insert the matchup row their own way (temp id vs serial).
 */
export async function applyMatchupScores(tx: Transaction, input: SubmitMatchupInput) {
  const [aId, bId] = 'winnerId' in input ? [input.winnerId, input.loserId] : input.drawIds;
  const winnerId = 'winnerId' in input ? input.winnerId : null;

  const [a, b] = await Promise.all([
    tx.run(zql.records.where('id', aId).one()),
    tx.run(zql.records.where('id', bId).one()),
  ]);
  if (!a || !b) throw new Error(`Submit matchup: record ${!a ? aId : bId} not found`);
  if (a.type !== b.type) {
    throw new Error(`Submit matchup: cross-type matchup (${a.type} vs ${b.type}) is not allowed`);
  }
  if (a.type === 'artifact') {
    const contained = await tx.run(
      zql.links.where('sourceId', 'IN', [aId, bId]).where('predicate', 'contained_by')
    );
    const child = contained[0];
    if (child) {
      throw new Error(
        `Submit matchup: record ${child.sourceId} is contained by a parent record and cannot be ranked`
      );
    }
  }

  const matchupsFor = (id: DbId) =>
    tx.run(zql.eloMatchups.where(({ cmp, or }) => or(cmp('recordAId', id), cmp('recordBId', id))));
  const [matchupsA, matchupsB] = await Promise.all([matchupsFor(aId), matchupsFor(bId)]);

  const { deltaA, deltaB } = eloDeltas(
    { eloScore: a.eloScore, matchupCount: matchupsA.length },
    { eloScore: b.eloScore, matchupCount: matchupsB.length },
    winnerId === null ? 'draw' : 'win'
  );

  await tx.mutate.records.update({ id: aId, eloScore: a.eloScore + deltaA });
  await tx.mutate.records.update({ id: bId, eloScore: b.eloScore + deltaB });

  return { aId, bId, winnerId, recordType: a.type };
}

export const mutators = defineMutators({
  records: {
    /* Embedding text is drawn from most of a record and from its relations and
     * media, and regeneration is cheap, so every write queues one rather than
     * keeping a list of which columns feed the vector in step with the text. */
    update: defineMutator(UpdateRecordSchema, async ({ tx, ctx, args }) => {
      const { id, isCurated, ...fields } = args;
      const curation = await curatedAtForUpdate(tx, id, isCurated);
      await tx.mutate.records.update({ ...fields, ...curation, id, recordUpdatedAt: Date.now() });
      await queueEmbeddings(tx, ctx, [id]);
    }),
    bulkUpdate: defineMutator(BulkUpdateSchema, async ({ tx, ctx, args: { ids, data } }) => {
      const now = Date.now();
      const { isCurated, ...fields } = data;
      for (const id of ids) {
        const curation = await curatedAtForUpdate(tx, id, isCurated);
        await tx.mutate.records.update({ ...fields, ...curation, id, recordUpdatedAt: now });
      }
      await queueEmbeddings(tx, ctx, ids);
    }),
  },
  links: {
    upsert: defineMutator(LinkUpsertSchema, async ({ tx, ctx, args }) => {
      const { sourceId, targetId, predicate } = canonicalizeLink(args);
      if (sourceId === targetId) throw new Error('sourceId and targetId cannot be identical');
      const now = Date.now();
      const notes = args.notes ?? null;

      if (args.id !== undefined) {
        const previous = await tx.run(zql.links.where('id', args.id).one());
        if (!previous) throw new Error('Link not found for update');
        await tx.mutate.links.update({
          id: args.id,
          sourceId,
          targetId,
          predicate,
          notes,
          recordUpdatedAt: now,
        });
        /* Retargeting a link leaves the old endpoints' embedding text stale,
         * so they regenerate alongside the new endpoints. */
        await queueEmbeddings(tx, ctx, [sourceId, targetId, previous.sourceId, previous.targetId]);
        return;
      }

      const existing = await tx.run(
        zql.links
          .where('sourceId', sourceId)
          .where('targetId', targetId)
          .where('predicate', predicate)
          .one()
      );
      if (existing) {
        await tx.mutate.links.update({ id: existing.id, notes, recordUpdatedAt: now });
      } else {
        await tx.mutate.links.insert({
          id: tempId(),
          sourceId,
          targetId,
          predicate,
          notes,
          recordCreatedAt: now,
          recordUpdatedAt: now,
        });
      }
      await queueEmbeddings(tx, ctx, [sourceId, targetId]);
    }),
    delete: defineMutator(DeleteLinksSchema, async ({ tx, ctx, args: { links } }) => {
      for (const link of links) {
        await tx.mutate.links.delete({ id: link.id });
      }
      await queueEmbeddings(
        tx,
        ctx,
        links.flatMap((link) => [link.sourceId, link.targetId])
      );
    }),
  },
  elo: {
    submitMatchup: defineMutator(SubmitMatchupInputSchema, async ({ tx, args }) => {
      const { aId, bId, winnerId, recordType } = await applyMatchupScores(tx, args);
      await tx.mutate.eloMatchups.insert({
        id: tempId(),
        recordAId: aId,
        recordBId: bId,
        winnerId,
        recordType,
        recordCreatedAt: Date.now(),
      });
    }),
    /**
     * Reverse a just-submitted matchup: delete its row and subtract the score
     * deltas it applied. The target must still be the newest matchup touching
     * either record, which guarantees no later result has moved these scores,
     * so subtracting the submitted deltas restores them exactly.
     */
    undoMatchup: defineMutator(UndoMatchupInputSchema, async ({ tx, args }) => {
      const { aId, bId, winnerId, deltaA, deltaB } = args;
      const latest = await tx.run(
        zql.eloMatchups
          .where(({ cmp, or }) =>
            or(
              cmp('recordAId', aId),
              cmp('recordBId', aId),
              cmp('recordAId', bId),
              cmp('recordBId', bId)
            )
          )
          .orderBy('recordCreatedAt', 'desc')
          .one()
      );
      if (
        !latest ||
        latest.recordAId !== aId ||
        latest.recordBId !== bId ||
        latest.winnerId !== winnerId
      ) {
        throw new Error('Undo matchup: a newer matchup involves these records');
      }
      const [a, b] = await Promise.all([
        tx.run(zql.records.where('id', aId).one()),
        tx.run(zql.records.where('id', bId).one()),
      ]);
      if (!a || !b) throw new Error(`Undo matchup: record ${!a ? aId : bId} not found`);
      await tx.mutate.records.update({ id: aId, eloScore: a.eloScore - deltaA });
      await tx.mutate.records.update({ id: bId, eloScore: b.eloScore - deltaB });
      await tx.mutate.eloMatchups.delete({ id: latest.id });
    }),
  },
});
