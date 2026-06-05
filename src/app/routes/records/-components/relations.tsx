import { PREDICATES, type PredicateType, type RecordType } from '@hozo';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MergeIcon,
  PlusIcon,
  ShapesIcon,
  TrashIcon,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ElementType } from 'react';
import { trpc } from '@/app/trpc';
import { Spinner } from '@/components/spinner';
import { ToggleGroup } from '@/components/toggle-group';
import { Tooltip } from '@/components/tooltip';
import { useDeleteLinks } from '@/lib/hooks/link-mutations';
import { useMergeRecords } from '@/lib/hooks/record-mutations';
import { usePredicateMap, useRecordLinks } from '@/lib/hooks/record-queries';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { exhaustive } from '@/shared/lib/type-utils';
import type { DbId } from '@/shared/types/api';
import type { LinkPartial } from '@/shared/types/domain';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { RecordLink } from './record-link';
import { RelationshipSelector } from './record-lookup';
import { recordTypeIcons } from './type-icons';

/** Predicate types in display priority order (first = highest priority) */
const PREDICATE_TYPE_ORDER = exhaustive<PredicateType>()([
  'identity',
  'containment',
  'creation',
  'reference',
  'association',
  'form',
  'description',
]);

interface RelationsListProps {
  id: DbId;
}

export const RelationsList = ({ id }: RelationsListProps) => {
  const { data: recordLinks } = useRecordLinks(id);
  const predicates = usePredicateMap();
  const mergeRecordsMutation = useMergeRecords();
  const deleteLinkMutation = useDeleteLinks();
  const navigate = useNavigate();
  const addRelationshipButtonRef = useRef<HTMLButtonElement | null>(null);

  // Keyboard shortcut to add a link to the current record
  useKeyboardShortcut('mod+shift+k', () => addRelationshipButtonRef.current?.click(), {
    description: 'Add link to record',
    category: 'Records',
    allowInInput: true,
  });

  const sortLinks = useCallback(
    (links: LinkPartial[]): LinkPartial[] => {
      return [...links].sort((a, b) => {
        const typeA = predicates[a.predicate]?.type;
        const typeB = predicates[b.predicate]?.type;
        const orderA = typeA ? PREDICATE_TYPE_ORDER.indexOf(typeA) : PREDICATE_TYPE_ORDER.length;
        const orderB = typeB ? PREDICATE_TYPE_ORDER.indexOf(typeB) : PREDICATE_TYPE_ORDER.length;

        // Sort by predicate type priority first
        if (orderA !== orderB) return orderA - orderB;

        // Then by recordUpdatedAt descending (most recent first)
        return b.recordUpdatedAt.getTime() - a.recordUpdatedAt.getTime();
      });
    },
    [predicates]
  );

  const outgoingLinks = useMemo(
    () =>
      sortLinks(
        recordLinks?.outgoingLinks.filter(
          (link) => predicates[link.predicate]?.type !== 'containment'
        ) ?? []
      ),
    [recordLinks, predicates, sortLinks]
  );
  const incomingLinks = useMemo(
    () =>
      sortLinks(
        recordLinks?.incomingLinks.filter(
          (link) => predicates[link.predicate]?.type !== 'containment'
        ) ?? []
      ),
    [recordLinks, predicates, sortLinks]
  );
  const totalLinks = useMemo(
    () => outgoingLinks.length + incomingLinks.length,
    [outgoingLinks, incomingLinks]
  );

  return (
    <section>
      <styled.header
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <styled.h3 css={{ marginBlockEnd: '2' }}>
          Relations{' '}
          <styled.span css={{ textStyle: 'sm', color: 'secondary' }}>({totalLinks})</styled.span>
        </styled.h3>
        <RelationshipSelector.Root
          sourceId={id}
          buildActions={({ sourceId, targetId }) => {
            return [
              {
                key: 'merge-records',
                label: (
                  <>
                    <MergeIcon /> Merge
                  </>
                ),
                onSelect: () => {
                  void navigate({
                    to: '/records/$recordId',
                    params: { recordId: targetId },
                    state: { focusForm: true },
                  });
                  mergeRecordsMutation.mutate({
                    sourceId,
                    targetId,
                  });
                },
              },
            ];
          }}
        >
          <RelationshipSelector.Trigger
            ref={addRelationshipButtonRef}
            variant="soft"
            css={{
              height: '[1.5lh]',
            }}
          >
            <PlusIcon /> Add
          </RelationshipSelector.Trigger>
          <RelationshipSelector.Content />
        </RelationshipSelector.Root>
      </styled.header>
      {outgoingLinks.length > 0 && (
        <>
          <styled.h4
            css={{
              marginBlockEnd: '2',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              fontFamily: 'mono',
              textStyle: 'sm',
              fontWeight: 'semibold',
              color: 'secondary',
              textTransform: 'uppercase',
              _childIcon: { boxSize: '4', color: 'muted' },
            }}
          >
            <ArrowRightIcon /> Outgoing
          </styled.h4>
          <styled.ul css={{ display: 'flex', flexDirection: 'column', gap: '2', textStyle: 'xs' }}>
            {outgoingLinks.map((link) => (
              <styled.li
                key={`${link.sourceId}-${link.targetId}-${link.predicate}`}
                css={{ display: 'flex', alignItems: 'center', gap: '2' }}
              >
                <RelationshipSelector.Root
                  sourceId={link.sourceId}
                  initialTargetId={link.targetId}
                  link={link}
                  buildActions={({ sourceId, targetId }) => {
                    return [
                      {
                        key: 'merge-records',
                        label: (
                          <>
                            <MergeIcon /> Merge
                          </>
                        ),
                        onSelect: () => {
                          void navigate({
                            to: '/records/$recordId',
                            params: { recordId: targetId },
                            state: { focusForm: true },
                          });
                          mergeRecordsMutation.mutate({
                            sourceId,
                            targetId,
                          });
                        },
                      },
                      {
                        key: 'delete-link',
                        label: (
                          <>
                            <TrashIcon /> Delete
                          </>
                        ),
                        onSelect: () => {
                          deleteLinkMutation.mutate([link.id]);
                        },
                      },
                    ];
                  }}
                >
                  <RelationshipSelector.Trigger
                    css={{
                      width: '28',
                    }}
                  >
                    {predicates[link.predicate]?.name ?? 'Unknown'}
                  </RelationshipSelector.Trigger>
                  <RelationshipSelector.Content />
                </RelationshipSelector.Root>
                <RecordLink
                  id={link.targetId}
                  linkOptions={{
                    to: '/records/$recordId',
                    params: { recordId: link.targetId },
                  }}
                />
              </styled.li>
            ))}
          </styled.ul>
        </>
      )}
      {incomingLinks.length > 0 && (
        <>
          <styled.h4
            data-after-outgoing={outgoingLinks.length > 0 || undefined}
            css={{
              marginBlockEnd: '2',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              fontFamily: 'mono',
              textStyle: 'sm',
              fontWeight: 'semibold',
              color: 'muted',
              textTransform: 'uppercase',
              _childIcon: { boxSize: '4' },
              '&[data-after-outgoing]': { marginBlockStart: '3' },
            }}
          >
            <ArrowLeftIcon /> Incoming
          </styled.h4>
          <styled.ul css={{ display: 'flex', flexDirection: 'column', gap: '2', textStyle: 'xs' }}>
            {incomingLinks.map((link) => (
              <styled.li
                key={`${link.sourceId}-${link.targetId}-${link.predicate}`}
                css={{ display: 'flex', alignItems: 'center', gap: '2' }}
              >
                <RelationshipSelector.Root
                  sourceId={link.targetId}
                  initialTargetId={link.sourceId}
                  incoming
                  link={link}
                  buildActions={() => {
                    return [
                      {
                        key: 'merge-records',
                        label: (
                          <>
                            <MergeIcon /> Merge
                          </>
                        ),
                        onSelect: () => {
                          void navigate({
                            to: '/records/$recordId',
                            params: { recordId: link.sourceId },
                            state: { focusForm: true },
                          });
                          mergeRecordsMutation.mutate({
                            sourceId: link.targetId,
                            targetId: link.sourceId,
                          });
                        },
                      },
                      {
                        key: 'delete-link',
                        label: (
                          <>
                            <TrashIcon /> Delete
                          </>
                        ),
                        onSelect: () => {
                          deleteLinkMutation.mutate([link.id]);
                        },
                      },
                    ];
                  }}
                >
                  <RelationshipSelector.Trigger
                    css={{
                      width: '28',
                    }}
                  >
                    {(() => {
                      const inv = predicates[link.predicate]?.inverseSlug;
                      return inv
                        ? (PREDICATES[inv as keyof typeof PREDICATES]?.name ?? 'Unknown')
                        : (predicates[link.predicate]?.name ?? 'Unknown');
                    })()}
                  </RelationshipSelector.Trigger>
                  <RelationshipSelector.Content />
                </RelationshipSelector.Root>
                <RecordLink
                  id={link.sourceId}
                  linkOptions={{
                    to: '/records/$recordId',
                    params: { recordId: link.sourceId },
                  }}
                />
              </styled.li>
            ))}
          </styled.ul>
        </>
      )}
    </section>
  );
};

/** Type filter for the similar records section. `all` clears the filter. */
type SimilarTypeFilter = RecordType | 'all';

const SIMILAR_TYPE_FILTERS: { value: SimilarTypeFilter; label: string; icon: ElementType }[] = [
  { value: 'all', label: 'All types', icon: ShapesIcon },
  { value: 'artifact', label: 'Artifacts', icon: recordTypeIcons.artifact.icon },
  { value: 'entity', label: 'Entities', icon: recordTypeIcons.entity.icon },
  { value: 'concept', label: 'Concepts', icon: recordTypeIcons.concept.icon },
];

export const SimilarRecords = ({ id }: { id: DbId }) => {
  const navigate = useNavigate();
  const mergeRecordsMutation = useMergeRecords();
  const [typeFilter, setTypeFilter] = useState<SimilarTypeFilter>('all');

  // Fetch similar records only if textEmbedding exists. Filtering by type happens in the query
  // so each type returns its own best matches rather than whatever survives the global top-N.
  const { data: similarRecords, isLoading } = trpc.search.byRecordId.useQuery(
    {
      id,
      limit: 20,
      type: typeFilter === 'all' ? undefined : typeFilter,
    },
    {
      trpc: {
        context: {
          skipBatch: true,
        },
      },
    }
  );

  const handleTypeFilterChange = (value: SimilarTypeFilter[]) => {
    setTypeFilter(value[0] ?? 'all');
  };

  return (
    <styled.section css={{ textStyle: 'xs' }}>
      <styled.header
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2',
          marginBlockEnd: '2',
        }}
      >
        <styled.h3>Similar Records</styled.h3>
        <ToggleGroup.Root
          variant="outline"
          size="sm"
          value={[typeFilter]}
          onValueChange={handleTypeFilterChange}
        >
          {SIMILAR_TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
            <Tooltip.Root key={value}>
              <Tooltip.Trigger
                render={
                  <ToggleGroup.Item value={value} aria-label={label}>
                    <Icon />
                  </ToggleGroup.Item>
                }
              />
              <Tooltip.Content>{label}</Tooltip.Content>
            </Tooltip.Root>
          ))}
        </ToggleGroup.Root>
      </styled.header>
      {isLoading ? (
        <Spinner />
      ) : similarRecords && similarRecords.length > 0 ? (
        <ul>
          {similarRecords.map((record) => (
            <styled.li
              key={record.id}
              css={{ marginBlockEnd: '2', display: 'flex', alignItems: 'center', gap: '4' }}
            >
              <RelationshipSelector.Root
                sourceId={id}
                initialTargetId={record.id}
                buildActions={({ sourceId, targetId }) => {
                  return [
                    {
                      key: 'merge-records',
                      label: (
                        <>
                          <MergeIcon /> Merge
                        </>
                      ),
                      onSelect: () => {
                        void navigate({
                          to: '/records/$recordId',
                          params: { recordId: targetId },
                          state: { focusForm: true },
                        });
                        mergeRecordsMutation.mutate({
                          sourceId,
                          targetId,
                        });
                      },
                    },
                  ];
                }}
              >
                <RelationshipSelector.Trigger
                  css={{
                    height: '[1.5lh]',
                    fontFamily: 'mono',
                    fontSize: 'xs',
                    color: 'secondary',
                  }}
                >
                  {`${Math.round(record.similarity * 100)}%`}
                </RelationshipSelector.Trigger>
                <RelationshipSelector.Content side="left" />
              </RelationshipSelector.Root>
              <RecordLink
                id={record.id}
                className={css({ flex: '1' })}
                linkOptions={{
                  to: '/records/$recordId',
                  params: { recordId: record.id },
                }}
              />
            </styled.li>
          ))}
        </ul>
      ) : (
        <p>No similar records found.</p>
      )}
    </styled.section>
  );
};
