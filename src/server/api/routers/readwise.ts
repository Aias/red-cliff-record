import { and, desc, eq, isNull } from 'drizzle-orm';
import { readwiseDocuments } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';
import { DEFAULT_LIMIT } from './common';

export const readwiseRouter = createTRPCRouter({
	getDocuments: publicProcedure.query(async ({ ctx }) => {
		const documents = await ctx.db.query.readwiseDocuments.findMany({
			columns: {
				embedding: false,
			},
			with: {
				children: true,
			},
			where: and(
				isNull(readwiseDocuments.recordId),
				eq(readwiseDocuments.location, 'archive'),
				isNull(readwiseDocuments.parentId)
			),
			orderBy: [desc(readwiseDocuments.archivedAt), desc(readwiseDocuments.contentCreatedAt)],
			limit: DEFAULT_LIMIT,
		});

		return documents;
	}),
});
