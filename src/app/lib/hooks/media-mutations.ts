import { trpc } from '@/app/trpc';
import type { DbId } from '@/shared/types';

export function useCreateMedia(id: DbId) {
  const utils = trpc.useUtils();
  return trpc.media.create.useMutation({
    onSuccess: (data) => {
      utils.records.get.setData({ id }, (prev) => {
        if (!prev) return undefined;
        return { ...prev, media: [...(prev.media ?? []), data] };
      });
    },
  });
}

export function useDeleteMedia() {
  const utils = trpc.useUtils();
  return trpc.media.delete.useMutation({
    onSuccess: (deletedMedia) => {
      for (const m of deletedMedia) {
        if (m.recordId) {
          utils.records.get.setData({ id: m.recordId }, (prev) => {
            if (!prev) return undefined;
            return {
              ...prev,
              media: prev.media?.filter((p) => p.id !== m.id),
            };
          });
        }
      }
    },
  });
}
