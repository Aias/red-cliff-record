import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useCreateMedia } from './use-records';
import { readFileAsBase64 } from '../read-file';
import type { DbId } from '@/server/api/routers/common';

export function useRecordUpload(recordId: DbId) {
  const createMediaMutation = useCreateMedia(recordId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setSuccess(false);
      try {
        const fileData = await readFileAsBase64(file);
        await createMediaMutation.mutateAsync({
          recordId,
          fileData,
          fileName: file.name,
          fileType: file.type,
        });
        setSuccess(true);
        toast.success('Media uploaded');
        return { success: true } as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        toast.error(message);
        return { success: false, error: message } as const;
      }
    },
    [recordId, createMediaMutation]
  );

  return {
    upload,
    isUploading: createMediaMutation.isLoading,
    success,
    error,
  } as const;
}
