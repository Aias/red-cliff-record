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
				outgoingLinks: {
					with: {
						target: columnsWithoutEmbedding,
						predicate: true,
					},
				},
				incomingLinks: {
					with: {
						source: columnsWithoutEmbedding,
						predicate: true,
					},
					limit: 50,
				},
				media: true,
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
