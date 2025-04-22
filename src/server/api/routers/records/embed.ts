import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';
import { records } from '@/db/schema';
import { createRecordEmbeddingText } from '@/lib/embedding';
import { createEmbedding } from '@/lib/server/create-embedding';

export const embed = publicProcedure
	.input(IdSchema)
	.mutation(async ({ ctx: { db }, input: recordId }) => {
		const record = await db.query.records.findFirst({
			where: {
				id: recordId,
			},
			with: {
				outgoingLinks: {
					with: {
						target: {
							columns: {
								textEmbedding: false,
							},
						},
						predicate: true,
					},
				},
				incomingLinks: {
					with: {
						source: {
							columns: {
								textEmbedding: false,
							},
						},
						predicate: true,
					},
					where: {
						predicate: {
							slug: {
								notIn: ['format_of'], // Would bring back too many that are not useful for embedding.
							},
						},
					},
				},
				media: true,
			},
		});

		if (!record) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: `Embed record: Record ${recordId} not found`,
			});
		}

		const embeddingText = createRecordEmbeddingText(record);

		const embedding = await createEmbedding(embeddingText);

		const [updatedRecord] = await db
			.update(records)
			.set({
				textEmbedding: embedding,
				recordUpdatedAt: new Date(),
			})
			.where(eq(records.id, recordId))
			.returning();

		if (!updatedRecord) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Embed record: Failed to embed record ${recordId}`,
			});
		}

		return updatedRecord;
	});
