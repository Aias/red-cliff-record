import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';
import type { FullRecord } from '../records.types';

const columnsWithoutEmbedding = {
	columns: {
		textEmbedding: false,
	},
} as const;

export const get = publicProcedure
	.input(IdSchema)
	.query(async ({ ctx: { db }, input }): Promise<FullRecord> => {
		const record = await db.query.records.findFirst({
			with: {
				creators: columnsWithoutEmbedding,
				created: columnsWithoutEmbedding,
				format: columnsWithoutEmbedding,
				formatOf: columnsWithoutEmbedding,
				parent: columnsWithoutEmbedding,
				children: columnsWithoutEmbedding,
				media: true,
				references: columnsWithoutEmbedding,
				referencedBy: columnsWithoutEmbedding,
				transcludes: columnsWithoutEmbedding,
			},
			where: {
				id: input,
			},
		});

		if (!record) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: `Get record: Record ${input} not found`,
			});
		}

		return record;
	});
