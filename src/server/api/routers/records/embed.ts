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
				creators: {
					columns: {
						textEmbedding: false,
					},
				},
				created: {
					columns: {
						textEmbedding: false,
					},
				},
				format: {
					columns: {
						textEmbedding: false,
					},
				},
				formatOf: {
					columns: {
						textEmbedding: false,
					},
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				parent: {
					columns: {
						textEmbedding: false,
					},
				},
				children: {
					columns: {
						textEmbedding: false,
					},
				},
				media: true,
				references: {
					columns: {
						textEmbedding: false,
					},
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				referencedBy: {
					columns: {
						textEmbedding: false,
					},
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				transcludes: {
					columns: {
						textEmbedding: false,
					},
				},
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
