import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { LinkInsertSchema, links } from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';
import { IdSchema } from './common';

export const linksRouter = createTRPCRouter({
	upsert: publicProcedure.input(LinkInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const [result] = await db
			.insert(links)
			.values(input)
			.onConflictDoUpdate({
				target: links.id,
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
	}),

	delete: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
		const deletedLinks = await db.delete(links).where(inArray(links.id, input)).returning();
		return deletedLinks;
	}),
});
