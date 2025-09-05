import { inArray } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import { feedEntries } from '@/server/db/schema/feeds';
import { createTRPCRouter, publicProcedure } from '../init';

function stripHtml(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

export const feedEntriesRouter = createTRPCRouter({
	latest: publicProcedure.query(async ({ ctx: { db } }) => {
		const rows = await db.query.feedEntries.findMany({
			columns: {
				id: true,
				title: true,
				url: true,
				textEmbedding: true,
			},
			where: {
				textEmbedding: {
					isNotNull: true,
				},
			},
			orderBy: (entries, { desc }) => [desc(entries.publishedAt), desc(entries.id)],
			limit: 1000,
		});
		return rows;
	}),
	summarize: publicProcedure
		.input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
		.mutation(async ({ ctx: { db }, input }) => {
			const entries = await db
				.select({
					title: feedEntries.title,
					summary: feedEntries.summary,
					content: feedEntries.content,
				})
				.from(feedEntries)
				.where(inArray(feedEntries.id, input.ids));

			const text = entries
				.map((e) => `Title: ${e.title ?? 'Untitled'}\n${stripHtml(e.summary ?? e.content ?? '')}`)
				.join('\n\n');

			const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

			const response = await openai.responses.create({
				model: 'gpt-4.1-mini',
				input: [{ role: 'user', content: text }],
				instructions:
					'Provide a concise paragraph summarizing the central themes across these blog posts.',
			});

			return { summary: response.output_text };
		}),
});
