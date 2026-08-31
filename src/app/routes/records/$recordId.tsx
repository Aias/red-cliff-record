import { isStructuralContainment, type PredicateSlug } from '@hozo';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Card } from '@/components/card';
import { Spinner } from '@/components/spinner';
import { useBulkUpdate, useDeleteRecords } from '@/lib/hooks/record-mutations';
import { useRecordList, useRecordTree, type RecordTreeData } from '@/lib/hooks/record-queries';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { CoercedIdSchema, type DbId } from '@/shared/types/api';
import { styled } from '@/styled-system/jsx';
import { RecordForm } from './-components/form';
import { RankSection } from './-components/rank';
import { RecordDisplay } from './-components/record-display';
import { RecordLink } from './-components/record-link';
import { RelationsList, SimilarRecords } from './-components/relations';

export const Route = createFileRoute('/records/$recordId')({
  params: { parse: (params) => ({ recordId: CoercedIdSchema.parse(params.recordId) }) },
  component: RouteComponent,
});

type TreeNode = {
  predicate?: PredicateSlug;
  /** True for structural containment (contained_by/contains), false for citation (quotes/quoted_in) */
  isStructural: boolean;
  title?: string | null;
  id: DbId;
};

/** A tree edge whose far endpoint resolved. */
type TreeEdge<T> = { predicate: PredicateSlug; record: T };

/** Content chronology, matching the public site's child ordering. */
type ChronologyRecord = { id: DbId; recordCreatedAt: number; contentCreatedAt?: number | null };

const chronologyAt = (record: ChronologyRecord) =>
  record.contentCreatedAt ?? record.recordCreatedAt;

const resolveEdges = <TLink extends { predicate: PredicateSlug }, TRecord>(
  links: readonly TLink[],
  endpoint: (link: TLink) => (TRecord & ChronologyRecord) | undefined
): TreeEdge<TRecord & ChronologyRecord>[] => {
  return links
    .flatMap((link) => {
      const record = endpoint(link);
      return record ? [{ predicate: link.predicate, record }] : [];
    })
    .sort((a, b) => chronologyAt(a.record) - chronologyAt(b.record) || a.record.id - b.record.id);
};

const toNode = (edge: TreeEdge<{ id: DbId; title: string | null }>): TreeNode => ({
  predicate: edge.predicate,
  isStructural: isStructuralContainment(edge.predicate),
  id: edge.record.id,
  title: edge.record.title,
});

const flattenTree = (tree: RecordTreeData): TreeNode[] => {
  const nodes: TreeNode[] = [];

  const parents = resolveEdges(tree.outgoingLinks, (link) => link.target);
  parents.forEach((parent) => {
    const grandparents = resolveEdges(parent.record.outgoingLinks, (link) => link.target);
    grandparents.forEach((grandparent) => nodes.push(toNode(grandparent)));

    nodes.push(toNode(parent));

    const siblings = resolveEdges(parent.record.incomingLinks, (link) => link.source);
    siblings.forEach((sibling) => nodes.push(toNode(sibling)));
  });

  // Only add if there are no outgoing links, otherwise we'll get duplicates from parent's child nodes.
  if (parents.length === 0) {
    nodes.push({
      id: tree.id,
      title: tree.title,
      isStructural: true,
    });
  }

  const children = resolveEdges(tree.incomingLinks, (link) => link.source);
  children.forEach((child) => nodes.push(toNode(child)));

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
  const { ids: listIds } = useRecordList(filtersState);
  const { recordId } = Route.useParams();
  const { data: tree, isError: treeError, isLoading: treeLoading } = useRecordTree(recordId);
  const bulkUpdate = useBulkUpdate();
  const deleteMutation = useDeleteRecords();

  // If tree query fails, it likely means the record doesn't exist (deleted or invalid ID)
  useEffect(() => {
    if (treeError && listIds.length) {
      // Navigate to first available record
      const firstAvailableId = listIds[0];
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
  }, [treeError, listIds, recordId, navigate]);

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
    const skip = new Set(idsToCurate);
    const nextId = getNextRecord(listIds, recordId, skip);

    // Trigger mutation optimistically
    void bulkUpdate({ ids: idsToCurate, data: { isCurated: true } });

    // Navigate immediately - tree structure is unaffected by curation
    if (nextId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: nextId },
      });
    } else {
      void navigate({ to: '/records' });
    }
  }, [bulkUpdate, nodes, listIds, recordId, navigate]);

  const handleDelete = useCallback(
    (id: DbId) => {
      deleteMutation.mutate([id]);
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
    [deleteMutation, listIds, recordId, navigate]
  );

  // Navigate to next record
  const navigateToNext = useCallback(() => {
    const nextId = getNextRecord(listIds, recordId, new Set());
    if (nextId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: nextId },
      });
    }
  }, [listIds, recordId, navigate]);

  // Navigate to previous record
  const navigateToPrevious = useCallback(() => {
    const prevId = getPreviousRecord(listIds, recordId, new Set());
    if (prevId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: prevId },
      });
    }
  }, [listIds, recordId, navigate]);

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
        <styled.div css={{ textAlign: 'center', palette: 'error', chromatic: true }}>
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
        <RankSection key={recordId} id={recordId} />
      </styled.div>
    </styled.div>
  );
}
