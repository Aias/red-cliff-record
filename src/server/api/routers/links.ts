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
import { IdSchema, type DbId } from './common';
import type { RecordLinks, RecordLinksMap } from './records.types';

export const linksRouter = createTRPCRouter({
	listForRecord: publicProcedure
		.input(z.object({ id: IdSchema }))
		.query(async ({ ctx: { db }, input }): Promise<RecordLinks> => {
			const recordWithLinks = await db.query.records.findFirst({
				columns: {
					id: true,
				},
				where: {
					id: input.id,
				},
				with: {
					outgoingLinks: {
						columns: {
							id: true,
							sourceId: true,
							targetId: true,
							predicateId: true,
						},
					},
					incomingLinks: {
						columns: {
							id: true,
							sourceId: true,
							targetId: true,
							predicateId: true,
						},
					},
				},
			});
			if (!recordWithLinks) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
			}

			return recordWithLinks;
		}),

	map: publicProcedure
		.input(z.object({ recordIds: z.array(IdSchema).min(1) }))
		.query(async ({ ctx: { db }, input: { recordIds } }): Promise<RecordLinksMap> => {
			const rows = await db.query.links.findMany({
				columns: {
					id: true,
					sourceId: true,
					targetId: true,
					predicateId: true,
				},
				where: {
					OR: [
						{
							sourceId: {
								in: recordIds,
							},
						},
						{
							targetId: {
								in: recordIds,
							},
						},
					],
				},
			});

			/* shape:  { 7: { outgoing:[], incoming:[] }, 42: { … } } */
			const map: Record<DbId, RecordLinks> = {};

			for (const row of rows) {
				/* outgoing for sourceId */
				(map[row.sourceId] ??= {
					outgoingLinks: [],
					incomingLinks: [],
					id: row.sourceId,
				}).outgoingLinks.push(row);
				/* incoming for targetId (if different) */
				if (row.targetId !== row.sourceId) {
					(map[row.targetId] ??= {
						outgoingLinks: [],
						incomingLinks: [],
						id: row.targetId,
					}).incomingLinks.push(row);
				}
			}
			return map;
		}),

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

	delete: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
		if (input.length === 0) {
			return []; // Return empty array if input is empty
		}
		const deletedLinks = await db.delete(links).where(inArray(links.id, input)).returning();
		return deletedLinks;
	}),
});
