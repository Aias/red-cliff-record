import { TRPCClientError } from '@trpc/client';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DbId } from '@/shared/types/api';
import { readFileAsBase64 } from '../read-file';
import { useCreateMedia } from './media-mutations';

export interface UseRecordUploadResult {
  uploadFile: (file: File) => Promise<void>;
  isUploading: boolean;
}

export function useRecordUpload(recordId: DbId): UseRecordUploadResult {
  const createMediaMutation = useCreateMedia();
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const fileData = await readFileAsBase64(file);
        await createMediaMutation.mutateAsync({
          recordId,
          fileData,
          fileName: file.name,
          fileType: file.type,
        });
        toast.success('Media uploaded');
      } catch (err) {
        if (!(err instanceof TRPCClientError)) {
          toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [recordId, createMediaMutation]
  );

  return { uploadFile, isUploading };
}
