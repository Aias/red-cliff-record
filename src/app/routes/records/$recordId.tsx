import { isStructuralContainment, type PredicateSlug } from '@hozo';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';
import { trpc } from '@/app/trpc';
import { Card } from '@/components/card';
import { Spinner } from '@/components/spinner';
import { useBulkUpdate, useDeleteRecords } from '@/lib/hooks/record-mutations';
import { useRecordTree } from '@/lib/hooks/record-queries';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import type { FamilyTree } from '@/server/api/routers/records/tree';
import { CoercedIdSchema, type DbId } from '@/shared/types/api';
import { styled } from '@/styled-system/jsx';
import { RecordForm } from './-components/form';
import { RecordDisplay } from './-components/record-display';
import { RecordLink } from './-components/record-link';
import { RelationsList, SimilarRecords } from './-components/relations';

export const Route = createFileRoute('/records/$recordId')({
  params: { parse: (params) => ({ recordId: CoercedIdSchema.parse(params.recordId) }) },
  component: RouteComponent,
  loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
    await queryClient.ensureQueryData(trpc.records.get.queryOptions({ id: recordId }));
  },
});

type TreeNode = {
  predicate?: PredicateSlug;
  /** True for structural containment (contained_by/contains), false for citation (quotes/quoted_in) */
  isStructural: boolean;
  title?: string | null;
  id: DbId;
  recordCreatedAt: Date;
};

const sortByRecordCreatedAt = <T extends { recordCreatedAt: Date }>(records: T[]): T[] => {
  return [...records].sort((a, b) => a.recordCreatedAt.getTime() - b.recordCreatedAt.getTime());
};

const flattenTree = (tree: FamilyTree): TreeNode[] => {
  const nodes: TreeNode[] = [];
  const { id, incomingLinks, outgoingLinks, title, recordCreatedAt } = tree;

  // Sort outgoing links by recordCreatedAt
  const sortedOutgoingLinks = sortByRecordCreatedAt(
    outgoingLinks.map((link) => ({
      ...link,
      recordCreatedAt: link.target.recordCreatedAt,
    }))
  );

  sortedOutgoingLinks.forEach((parent) => {
    const {
      predicate: parentPredicate,
      target: {
        id: parentId,
        title: parentTitle,
        recordCreatedAt: parentRecordCreatedAt,
        incomingLinks: parentIncomingLinks,
        outgoingLinks: parentOutgoingLinks,
      },
    } = parent;

    // Sort grandparent links by recordCreatedAt
    const sortedGrandparentLinks = sortByRecordCreatedAt(
      parentOutgoingLinks.map((link) => ({
        ...link,
        recordCreatedAt: link.target.recordCreatedAt,
      }))
    );

    sortedGrandparentLinks.forEach((grandparent) => {
      const {
        predicate: grandparentPredicate,
        target: {
          id: grandparentId,
          title: grandparentTitle,
          recordCreatedAt: grandparentRecordCreatedAt,
        },
      } = grandparent;

      nodes.push({
        predicate: grandparentPredicate,
        isStructural: isStructuralContainment(grandparentPredicate),
        id: grandparentId,
        title: grandparentTitle,
        recordCreatedAt: grandparentRecordCreatedAt,
      });
    });

    nodes.push({
      predicate: parentPredicate,
      isStructural: isStructuralContainment(parentPredicate),
      id: parentId,
      title: parentTitle,
      recordCreatedAt: parentRecordCreatedAt,
    });

    // Sort child links by recordCreatedAt
    const sortedChildLinks = sortByRecordCreatedAt(
      parentIncomingLinks.map((link) => ({
        ...link,
        recordCreatedAt: link.source.recordCreatedAt,
      }))
    );

    sortedChildLinks.forEach((child) => {
      const {
        predicate: childPredicate,
        source: { id: childId, title: childTitle, recordCreatedAt: childRecordCreatedAt },
      } = child;

      nodes.push({
        predicate: childPredicate,
        isStructural: isStructuralContainment(childPredicate),
        id: childId,
        title: childTitle,
        recordCreatedAt: childRecordCreatedAt,
      });
    });
  });

  // Only add if there are no outgoing links, otherwise we'll get duplicates from parent's child nodes.
  if (outgoingLinks.length === 0) {
    nodes.push({ id, title, recordCreatedAt, isStructural: true });
  }

  // Sort incoming links by recordCreatedAt
  const sortedIncomingLinks = sortByRecordCreatedAt(
    incomingLinks.map((link) => ({
      ...link,
      recordCreatedAt: link.source.recordCreatedAt,
    }))
  );

  sortedIncomingLinks.forEach((child) => {
    const {
      predicate: childPredicate,
      source: { id: childId, title: childTitle, recordCreatedAt: childRecordCreatedAt },
    } = child;

    nodes.push({
      predicate: childPredicate,
      isStructural: isStructuralContainment(childPredicate),
      id: childId,
      title: childTitle,
      recordCreatedAt: childRecordCreatedAt,
    });
  });

  return nodes;
};

const getNextRecord = (ids: DbId[], currentId: DbId, skip: Set<DbId>): DbId | undefined => {
  if (ids.length === 0) return undefined;

  const currentIndex = ids.findIndex((id) => id === currentId);
  const start = currentIndex === -1 ? 0 : (currentIndex + 1) % ids.length;

  for (let i = 0; i < ids.length; i++) {
    const idx = (start + i) % ids.length;
    const id = ids[idx];
    if (id === undefined) continue;
    if (!skip.has(id)) return id;
  }

  return undefined;
};

const getPreviousRecord = (ids: DbId[], currentId: DbId, skip: Set<DbId>): DbId | undefined => {
  if (ids.length === 0) return undefined;

  const currentIndex = ids.findIndex((id) => id === currentId);
  const start = currentIndex === -1 ? ids.length - 1 : (currentIndex - 1 + ids.length) % ids.length;

  for (let i = 0; i < ids.length; i++) {
    const idx = (start - i + ids.length) % ids.length;
    const id = ids[idx];
    if (id === undefined) continue;
    if (!skip.has(id)) return id;
  }

  return undefined;
};

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { state: filtersState } = useRecordFilters();
  const { data: recordsList } = trpc.records.list.useQuery(
    { ...filtersState, offset: 0 },
    { placeholderData: (prev) => prev }
  );
  const { recordId } = Route.useParams();
  const { data: tree, isError: treeError, isLoading: treeLoading } = useRecordTree(recordId);
  const bulkUpdate = useBulkUpdate();
  const deleteMutation = useDeleteRecords();

  // If tree query fails, it likely means the record doesn't exist (deleted or invalid ID)
  useEffect(() => {
    if (treeError && recordsList?.ids.length) {
      // Navigate to first available record
      const firstAvailableId = recordsList.ids[0]?.id;
      if (firstAvailableId && firstAvailableId !== recordId) {
        void navigate({
          to: '/records/$recordId',
          params: { recordId: firstAvailableId },
        });
      } else {
        // No records available, go to records list
        void navigate({ to: '/records' });
      }
    }
  }, [treeError, recordsList, recordId, navigate]);

  const nodes = useMemo(() => {
    if (!tree) return [];
    return flattenTree(tree);
  }, [tree]);

  // Instant scroll to the active record when navigating
  useEffect(() => {
    if (!tree || nodes.length === 0) return;

    // Use requestAnimationFrame to ensure DOM is rendered
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-record-id="${recordId}"]`);
      if (element) {
        element.scrollIntoView({
          behavior: 'instant',
          block: 'center',
        });
      }
    });
  }, [recordId, tree, nodes.length]);

  const handleFinalize = useCallback(() => {
    const idsToCurate = Array.from(new Set(nodes.map((t) => t.id)));

    // Calculate next ID before triggering mutations to avoid race conditions
    const listIds = recordsList?.ids.map((r) => r.id) ?? [];
    const skip = new Set(idsToCurate);
    const nextId = getNextRecord(listIds, recordId, skip);

    // Trigger mutation optimistically
    bulkUpdate.mutate({ ids: idsToCurate, data: { isCurated: true } });

    // Navigate immediately - tree structure is unaffected by curation
    if (nextId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: nextId },
      });
    } else {
      void navigate({ to: '/records' });
    }
  }, [bulkUpdate, nodes, recordsList, recordId, navigate]);

  const handleDelete = useCallback(
    (id: DbId) => {
      deleteMutation.mutate([id]);
      const listIds = recordsList?.ids.map((r) => r.id) ?? [];
      const skip = new Set([id]);
      const nextId = getNextRecord(listIds, recordId, skip);

      if (nextId) {
        void navigate({
          to: '/records/$recordId',
          params: { recordId: nextId },
        });
      } else {
        void navigate({ to: '/records' });
      }
    },
    [deleteMutation, recordsList, recordId, navigate]
  );

  // Navigate to next record
  const navigateToNext = useCallback(() => {
    const listIds = recordsList?.ids.map((r) => r.id) ?? [];
    const nextId = getNextRecord(listIds, recordId, new Set());
    if (nextId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: nextId },
      });
    }
  }, [recordsList, recordId, navigate]);

  // Navigate to previous record
  const navigateToPrevious = useCallback(() => {
    const listIds = recordsList?.ids.map((r) => r.id) ?? [];
    const prevId = getPreviousRecord(listIds, recordId, new Set());
    if (prevId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: prevId },
      });
    }
  }, [recordsList, recordId, navigate]);

  // Navigate back to records list
  const navigateToList = useCallback(() => {
    void navigate({ to: '/records' });
  }, [navigate]);

  // Keyboard shortcuts for record navigation
  useKeyboardShortcut('mod+shift+arrowdown', navigateToNext, {
    description: 'Go to next record',
    category: 'Records',
  });

  useKeyboardShortcut('mod+shift+arrowup', navigateToPrevious, {
    description: 'Go to previous record',
    category: 'Records',
  });

  useKeyboardShortcut('escape', navigateToList, {
    description: 'Go back to record list',
    category: 'Records',
  });

  if (treeLoading) {
    return (
      <styled.div
        css={{ display: 'flex', flex: '1', alignItems: 'center', justifyContent: 'center' }}
      >
        <Spinner />
      </styled.div>
    );
  }

  if (treeError) {
    return (
      <styled.div
        css={{ display: 'flex', flex: '1', alignItems: 'center', justifyContent: 'center' }}
      >
        <styled.div css={{ textAlign: 'center', colorPalette: 'error', layerStyle: 'chromatic' }}>
          <styled.div css={{ marginBlockEnd: '2', color: 'accent' }}>Record not found</styled.div>
          <styled.div css={{ textStyle: 'sm', color: 'muted' }}>
            This record may have been deleted or moved.
          </styled.div>
        </styled.div>
      </styled.div>
    );
  }

  return (
    <styled.div css={{ display: 'flex', flex: '1', overflowX: 'auto' }}>
      <styled.ul
        css={{
          display: 'flex',
          maxWidth: '160',
          minWidth: '112',
          flexShrink: '1',
          flexBasis: '1/2',
          flexDirection: 'column',
          gap: '2',
          overflowY: 'auto',
          borderInlineEnd: 'divider',
          backgroundColor: 'container',
          padding: '3',
          '@container (max-width: 40rem)': { minWidth: 'screenW' },
        }}
      >
        {nodes.map((node) => (
          <Card
            key={node.id}
            as="li"
            compact={!node.isStructural}
            data-record-id={node.id}
            css={{ flexShrink: '0', _last: { marginBlockEnd: '8' } }}
          >
            {node.id === recordId ? (
              <RecordForm
                recordId={node.id}
                onFinalize={handleFinalize}
                onDelete={() => handleDelete(node.id)}
              />
            ) : node.isStructural ? (
              <RecordDisplay recordId={node.id} />
            ) : (
              <RecordLink
                id={node.id}
                linkOptions={{ to: '/records/$recordId', params: { recordId: node.id } }}
              />
            )}
          </Card>
        ))}
      </styled.ul>
      <styled.div
        css={{
          display: 'flex',
          maxWidth: '160',
          minWidth: '96',
          flex: '1',
          flexDirection: 'column',
          gap: '4',
          overflowY: 'auto',
          padding: '4',
          '@container (max-width: 40rem)': { minWidth: 'screenW' },
        }}
      >
        <RelationsList id={recordId} />
        <SimilarRecords id={recordId} />
      </styled.div>
    </styled.div>
  );
}
