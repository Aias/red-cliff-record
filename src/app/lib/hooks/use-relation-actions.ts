import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { DbId } from '@/server/api/routers/common';
import { useMergeRecords, useDeleteLinks } from '@/lib/hooks/use-records';

/**
 * Provides standardized handlers for relation operations such as merging
 * records or deleting links.
 */
export function useRelationActions() {
  const navigate = useNavigate();
  const mergeRecordsMutation = useMergeRecords();
  const deleteLinkMutation = useDeleteLinks();

  const merge = useCallback(
    (sourceId: DbId, targetId: DbId) => {
      navigate({
        to: '/records/$recordId',
        params: { recordId: targetId.toString() },
        search: true,
      });
      mergeRecordsMutation.mutate({ sourceId, targetId });
    },
    [navigate, mergeRecordsMutation]
  );

  const deleteLink = useCallback(
    (linkId: number | number[]) => {
      const ids = Array.isArray(linkId) ? linkId : [linkId];
      if (ids.length > 0) {
        deleteLinkMutation.mutate(ids);
      }
    },
    [deleteLinkMutation]
  );

  return { merge, deleteLink };
}
