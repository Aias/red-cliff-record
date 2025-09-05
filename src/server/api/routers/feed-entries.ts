import { inArray } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import { feedEntries } from '@/server/db/schema/feeds';
import { createTRPCRouter, publicProcedure } from '../init';

function stripHtml(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

export const feedEntriesRouter = createTRPCRouter({
	latest: publicProcedure
		.input(z.object({ limit: z.number().int().min(50).max(1000).default(250) }).optional())
		.query(async ({ ctx: { db }, input }) => {
			const limit = input?.limit ?? 250;
			const rows = await db.query.feedEntries.findMany({
				columns: {
					id: true,
					title: true,
					url: true,
					author: true,
					publishedAt: true,
					recordCreatedAt: true,
					recordUpdatedAt: true,
					textEmbedding: true,
				},
				where: {
					textEmbedding: {
						isNotNull: true,
					},
				},
				orderBy: (entries, { desc }) => [desc(entries.recordCreatedAt), desc(entries.id)],
				limit,
			});
			return rows;
		}),
	summarize: publicProcedure
		.input(z.object({ clusters: z.array(z.array(z.number().int().positive()).min(1)).min(1) }))
		.mutation(async ({ ctx: { db }, input }) => {
			const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
			const summaries: string[] = [];

			for (const clusterIds of input.clusters) {
				const entries = await db
					.select({
						title: feedEntries.title,
						summary: feedEntries.summary,
						content: feedEntries.content,
					})
					.from(feedEntries)
					.where(inArray(feedEntries.id, clusterIds));

				const text = entries
					.map((e) => `Title: ${e.title ?? 'Untitled'}\n${stripHtml(e.summary ?? e.content ?? '')}`)
					.join('\n\n');

				const response = await openai.responses.create({
					model: 'gpt-4.1-mini',
					input: [{ role: 'user', content: text }],
					instructions:
						'Provide a concise paragraph summarizing the central themes across these blog posts.',
				});

				summaries.push(response.output_text);
			}

			return { summaries };
		}),
});
