import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { records } from '@/db/schema';
import { createEmbedding } from '@/lib/server/create-embedding';
import { createRecordEmbeddingText } from '@/shared/lib/embedding';
import { IdParamSchema } from '@/shared/types';

export const embed = publicProcedure
	.input(IdParamSchema)
	.mutation(async ({ ctx: { db }, input: { id } }) => {
		const record = await db.query.records.findFirst({
			where: {
				id,
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
				message: `Embed record: Record ${id} not found`,
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
			.where(eq(records.id, id))
			.returning({
				id: records.id,
				recordUpdatedAt: records.recordUpdatedAt,
			});

		if (!updatedRecord) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Embed record: Failed to embed record ${id}`,
			});
		}

		return updatedRecord;
	});
