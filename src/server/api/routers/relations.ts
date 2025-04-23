import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { LinkInsertSchema, links, type LinkSelect } from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';
import { IdSchema } from './common';

export const linksRouter = createTRPCRouter({
	upsert: publicProcedure.input(LinkInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		let newLink: LinkSelect;
		if (input.id) {
			const [result] = await db.update(links).set(input).where(eq(links.id, input.id)).returning();
			if (!result) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Record relation not found. Input data:\n\n${JSON.stringify(input, null, 2)}`,
				});
			}
			newLink = result;
		} else {
			const [result] = await db
				.insert(links)
				.values(input)
				.onConflictDoUpdate({
					target: [links.sourceId, links.targetId, links.predicateId],
					set: {
						...input,
						recordUpdatedAt: new Date(),
					},
				})
				.returning();

			if (!result) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Record relation upsert failed. Input data:\n\n${JSON.stringify(input, null, 2)}`,
				});
			}
			newLink = result;
		}

		return newLink;
	}),

	listPredicates: publicProcedure.query(async ({ ctx: { db } }) => {
		const predicates = await db.query.predicates.findMany();
		return predicates;
	}),

	delete: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
		const deletedLinks = await db.delete(links).where(inArray(links.id, input)).returning();
		return deletedLinks;
	}),
});
