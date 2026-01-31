import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DbId } from '@/shared/types/api';
import { readFileAsBase64 } from '../read-file';
import { useCreateMedia } from './media-mutations';

export interface UseRecordUploadResult {
  uploadFile: (file: File) => Promise<void>;
  isUploading: boolean;
  isSuccess: boolean;
  error: Error | null;
}

export function useRecordUpload(recordId: DbId): UseRecordUploadResult {
  const createMediaMutation = useCreateMedia(recordId);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsSuccess(false);
      setError(null);
      setIsUploading(true);
      try {
        const fileData = await readFileAsBase64(file);
        await createMediaMutation.mutateAsync({
          recordId,
          fileData,
          fileName: file.name,
          fileType: file.type,
        });
        setIsSuccess(true);
        toast.success('Media uploaded');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during upload';
        setError(err instanceof Error ? err : new Error(message));
        toast.error(`Upload failed: ${message}`);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [recordId, createMediaMutation]
  );

  return { uploadFile, isUploading, isSuccess, error };
}
