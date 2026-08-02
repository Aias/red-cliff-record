import type { MutateRequest, ReadonlyJSONValue } from '@rocicorp/zero';
import { useZero } from '@rocicorp/zero/react';
import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Execute a Zero mutation. Resolves once the optimistic (client) apply
 * finishes; server rejections surface as an error toast when they arrive
 * and Zero rolls the optimistic change back automatically.
 */
export function useZeroMutate() {
  const zero = useZero();
  return useCallback(
    async <TInput extends ReadonlyJSONValue | undefined>(request: MutateRequest<TInput>) => {
      const result = zero.mutate(request);
      void result.server.then((details) => {
        if (details.type === 'error') toast.error(details.error.message);
      });
      const client = await result.client;
      if (client.type === 'error') {
        toast.error(client.error.message);
        throw new Error(client.error.message);
      }
    },
    [zero]
  );
}
