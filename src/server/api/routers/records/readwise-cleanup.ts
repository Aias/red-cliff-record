import { z } from 'zod';
import {
  applyCleanup,
  ReadwiseCleanupSnapshotSchema,
  undoCleanup,
} from '@/server/integrations/readwise/cleanup/apply';
import { previewCleanup } from '@/server/integrations/readwise/cleanup/preview';
import { ReadwiseCleanupChangeSchema } from '@/shared/readwise-cleanup';
import { publicProcedure } from '../../init';

export const previewReadwiseCleanupProcedure = publicProcedure
  .input(
    z.object({
      id: z.int().positive(),
      editorial: z.boolean().default(false),
      merge: z.array(z.int().positive()).min(2).optional(),
    })
  )
  .query(({ input: { id, ...options }, signal }) => previewCleanup(id, { ...options, signal }));

export const applyReadwiseCleanupProcedure = publicProcedure
  .input(z.object({ changes: z.array(ReadwiseCleanupChangeSchema).min(1) }))
  .mutation(({ input }) => applyCleanup(input.changes));

export const undoReadwiseCleanupProcedure = publicProcedure
  .input(z.object({ snapshot: ReadwiseCleanupSnapshotSchema }))
  .mutation(({ input }) => undoCleanup(input.snapshot));
