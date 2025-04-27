import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../init';
import { IdParamSchema } from '../common';
import type { RecordGet } from '../records.types';

export const get = publicProcedure
	.input(IdParamSchema)
	.query(async ({ ctx: { loaders }, input: { id } }): Promise<RecordGet> => {
		const record = await loaders.record.load(id);
		if (record instanceof Error) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: `Get record: Record ${id} not found`,
			});
		}

		return record;
	});
