import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/app/trpc';
import type { DbId } from '@/shared/types/api';

export function useCreateMedia(id: DbId) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.media.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.records.get.queryKey({ id }), (prev) => {
          if (!prev) return undefined;
          return { ...prev, media: [...(prev.media ?? []), data] };
        });
      },
    })
  );
}

export function useDeleteMedia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.media.delete.mutationOptions({
      onSuccess: (deletedMedia) => {
        for (const m of deletedMedia) {
          if (m.recordId) {
            queryClient.setQueryData(trpc.records.get.queryKey({ id: m.recordId }), (prev) => {
              if (!prev) return undefined;
              return {
                ...prev,
                media: prev.media?.filter((p) => p.id !== m.id),
              };
            });
          }
        }
      },
    })
  );
}
