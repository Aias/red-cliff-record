import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createEmbedding } from '@/server/services/ai/create-embedding';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';
import { records } from '@/db/schema';
import { createRecordEmbeddingText } from '@/lib/embedding';

export const embed = publicProcedure
	.input(IdSchema)
	.mutation(async ({ ctx: { db }, input: recordId }) => {
		const record = await db.query.records.findFirst({
			where: {
				id: recordId,
			},
			with: {
				creators: true,
				created: true,
				format: true,
				formatOf: {
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				parent: true,
				children: true,
				media: true,
				references: {
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				referencedBy: {
					limit: 20,
					orderBy: {
						recordUpdatedAt: 'desc',
					},
				},
				transcludes: true,
			},
		});

		if (!record) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
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
			throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to embed record' });
		}

		return updatedRecord;
	});
