import { desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { media } from '~/server/db/schema/main';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const mediaRouter = createTRPCRouter({
	search: publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
		return db.query.media.findMany({
			where: sql`(
				${media.title} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
				${media.altText} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
				${media.url} <-> ${input} < ${SIMILARITY_THRESHOLD}
			)`,
			limit: 10,
			orderBy: [
				sql`LEAST(
					${media.title} <-> ${input},
					${media.altText} <-> ${input},
					${media.url} <-> ${input}
				)`,
				desc(media.updatedAt),
			],
		});
	}),
});
