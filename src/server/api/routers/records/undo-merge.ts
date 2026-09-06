import { z } from 'zod';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import { MergeSnapshotSchema, undoMergeInTransaction } from '@/server/services/merge-records';
import { publicProcedure } from '../../init';

export const undoMerge = publicProcedure
  .input(z.object({ snapshot: MergeSnapshotSchema }))
  .mutation(async ({ ctx: { db }, input: { snapshot } }) => {
    const { touchedIds, ...restored } = await db.transaction((tx) =>
      undoMergeInTransaction(tx, snapshot)
    );
    queueRecordEmbeddings(touchedIds);
    return restored;
  });
