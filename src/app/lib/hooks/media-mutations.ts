import { useMutation } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';

/**
 * Media create/delete stay on tRPC: uploads move bytes to R2 and the rows
 * sync back into the local graph through replication.
 */
export function useCreateMedia() {
  const trpc = useTRPC();
  return useMutation(trpc.media.create.mutationOptions());
}

export function useDeleteMedia() {
  const trpc = useTRPC();
  return useMutation(trpc.media.delete.mutationOptions());
}
