import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';
import type { FullRecord } from '../records.types';

export const get = publicProcedure
	.input(IdSchema)
	.query(async ({ ctx: { db }, input }): Promise<FullRecord> => {
		const record = await db.query.records.findFirst({
			with: {
				creators: true,
				created: true,
				format: true,
				formatOf: true,
				parent: true,
				children: true,
				media: true,
				references: true,
				referencedBy: true,
				transcludes: true,
			},
			where: {
				id: input,
			},
		});

		if (!record) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
		}

		return record;
	});
