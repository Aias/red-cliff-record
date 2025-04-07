import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';

export const get = publicProcedure.input(IdSchema).query(async ({ ctx: { db }, input }) => {
	const record = await db.query.records.findFirst({
		with: {
			creators: {
				with: {
					creator: true,
				},
			},
			created: {
				with: {
					record: true,
				},
			},
			format: true,
			formatOf: true,
			parent: true,
			children: true,
			media: true,
			references: {
				with: {
					target: true,
				},
			},
			referencedBy: {
				with: {
					source: true,
				},
			},
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
