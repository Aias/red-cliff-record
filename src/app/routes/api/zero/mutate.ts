import { PushProcessor } from '@rocicorp/zero/server';
import { createFileRoute } from '@tanstack/react-router';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import { zeroDb } from '@/server/zero/db';
import { serverMutators } from '@/server/zero/mutators';
import type { DbId } from '@/shared/types/api';

const handle = async ({ request }: { request: Request }) => {
  /* Embeddings must read committed data, so mutators only collect ids here
   * and the regeneration is queued after the transactions finish. */
  const pending = new Set<DbId>();
  const processor = new PushProcessor(zeroDb, {
    queueEmbeddings: (ids: DbId[]) => ids.forEach((id) => pending.add(id)),
  });
  const response = await processor.process(serverMutators, request);
  queueRecordEmbeddings([...pending]);
  return Response.json(response);
};

export const Route = createFileRoute('/api/zero/mutate')({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
