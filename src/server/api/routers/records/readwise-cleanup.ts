import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  applyReadwiseCleanup,
  ReadwiseCleanupSnapshotSchema,
  undoReadwiseCleanup,
} from '@/server/integrations/readwise/cleanup/apply';
import { previewReadwiseCleanup } from '@/server/integrations/readwise/cleanup/preview';
import { ReadwiseCleanupPreviewSchema } from '@/shared/readwise-cleanup';
import { publicProcedure } from '../../init';

export const previewReadwiseCleanupProcedure = publicProcedure
  .input(z.object({ id: z.int().positive(), editorial: z.boolean().default(false) }))
  .query(({ input, signal }) =>
    previewReadwiseCleanup(input.id, { editorial: input.editorial, signal })
  );

export const combineReadwiseCleanupProcedure = publicProcedure
  .input(
    z.object({
      id: z.int().positive(),
      recordIds: z.array(z.int().positive()).min(2),
      editorial: z.boolean().default(true),
    })
  )
  .query(async ({ input, signal }) => {
    const preview = await previewReadwiseCleanup(input.id, {
      combineRecordIds: input.recordIds,
      editorial: input.editorial,
      signal,
    });
    const [change] = preview.changes;
    if (!change) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The selected highlights could not be combined.',
      });
    }
    return { ...change, warnings: [...new Set([...change.warnings, ...preview.issues])] };
  });

export const applyReadwiseCleanupProcedure = publicProcedure
  .input(
    z.object({
      preview: ReadwiseCleanupPreviewSchema,
      recordIds: z.array(z.int().positive()).nonempty(),
    })
  )
  .mutation(({ input }) => applyReadwiseCleanup(input.preview, input.recordIds));

export const undoReadwiseCleanupProcedure = publicProcedure
  .input(z.object({ snapshot: ReadwiseCleanupSnapshotSchema }))
  .mutation(({ input }) => undoReadwiseCleanup(input.snapshot));
