import { IdParamSchema } from '@/shared/types/api';
import type { RecordGet } from '@/shared/types/domain';
import { publicProcedure } from '../../init';

export const get = publicProcedure
  .input(IdParamSchema)
  .query(({ ctx: { loaders }, input: { id } }): Promise<RecordGet> => loaders.record.load(id));
