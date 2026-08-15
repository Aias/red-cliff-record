import type { DbId } from '@/shared/types/api';

/**
 * Context passed to Zero mutators and queries. Undefined on the client; the
 * server constructs one per mutate request.
 */
export interface ZeroAppContext {
  /**
   * Collect record ids whose text embeddings should be regenerated once the
   * enclosing transaction commits (embeddings must read committed data).
   * Mutators reach this through `queueEmbeddings`, which also marks the
   * records pending; calling it directly leaves them unmarked.
   */
  regenerateEmbeddings: (ids: DbId[]) => void;
}

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    context: ZeroAppContext | undefined;
  }
}
