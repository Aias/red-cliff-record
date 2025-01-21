import { desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { media } from '~/server/db/schema/main';
import { createTRPCRouter, publicProcedure } from '../init';

export const mediaRouter = createTRPCRouter({
	search: publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
		return db.query.media.findMany({
			where: or(
				ilike(media.title, `%${input}%`),
				ilike(media.altText, `%${input}%`),
				ilike(media.url, `%${input}%`)
			),
			limit: 10,
			orderBy: desc(media.updatedAt),
		});
	}),
});
