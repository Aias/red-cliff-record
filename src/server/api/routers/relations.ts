import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
	LinkInsertSchema,
	links,
	type LinkInsert,
	type LinkSelect,
	type PredicateSelect,
} from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';
import { IdSchema } from './common';

export const linksRouter = createTRPCRouter({
	/*  links.upsert  ------------------------------------------------------------
	 * – Accepts LinkInsertSchema
	 * – Re-writes non-canonical predicates to the canonical triple
	 * – Rejects self-links and unreversible predicates
	 * – Uses a single Drizzle transaction
	 * – Writes only the fields you explicitly allow
	 * ------------------------------------------------------------------------- */
	upsert: publicProcedure.input(LinkInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const result = await db.transaction(async (tx) => {
			/* 1 ─ fetch predicate + inverse inside the tx */
			const predicate = await tx.query.predicates.findFirst({
				where: { id: input.predicateId },
				with: { inverse: true },
			});
			if (!predicate) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Predicate not found' });
			}

			/* 2 ─ compute canonical direction */
			let { sourceId, targetId, predicateId } = input;
			if (!predicate.canonical) {
				const inv = predicate.inverse;
				if (!inv?.canonical) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Non-canonical predicate is not reversible',
					});
				}
				sourceId = input.targetId;
				targetId = input.sourceId;
				predicateId = inv.id;
			}

			if (sourceId === targetId) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'sourceId and targetId cannot be identical',
				});
			}

			const now = new Date();

			/* 3 ─ build write payload with only safe fields                */
			const linkData = {
				sourceId,
				targetId,
				predicateId,
				notes: input.notes ?? null,
				recordUpdatedAt: now,
			} satisfies Partial<LinkInsert>;

			let row: LinkSelect | undefined;

			if (input.id) {
				/* UPDATE --------------------------------------------------- */
				[row] = await tx.update(links).set(linkData).where(eq(links.id, input.id)).returning();
				if (!row) {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found for update' });
				}
			} else {
				/* INSERT … ON CONFLICT ------------------------------------ */
				[row] = await tx
					.insert(links)
					.values(linkData)
					.onConflictDoUpdate({
						target: [links.sourceId, links.targetId, links.predicateId],
						set: { ...linkData, recordUpdatedAt: now },
					})
					.returning();
				if (!row) {
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'Failed to insert or update link',
					});
				}
			}

			return row;
		}); /* end transaction */

		if (!result) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Transaction returned no result',
			});
		}
		return result;
	}),

	listPredicates: publicProcedure.query(async ({ ctx: { db } }): Promise<PredicateSelect[]> => {
		const predicates = await db.query.predicates.findMany();
		return predicates;
	}),

	deleteLinks: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
		if (input.length === 0) {
			return []; // Return empty array if input is empty
		}
		const deletedLinks = await db.delete(links).where(inArray(links.id, input)).returning();
		return deletedLinks;
	}),
});
