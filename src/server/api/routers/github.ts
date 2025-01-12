import { createTRPCRouter, publicProcedure } from '../trpc';
import { desc } from 'drizzle-orm';
import { githubCommits } from '~/server/db/schema/integrations';

export const githubRouter = createTRPCRouter({
	commits: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.githubCommits.findMany({
			with: {
				repository: true,
				commitChanges: true,
			},
			orderBy: [desc(githubCommits.committedAt)],
			limit: 50,
		});
	}),
});
