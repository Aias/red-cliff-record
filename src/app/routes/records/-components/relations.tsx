import { PREDICATES, type PredicateType } from '@hozo';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, MergeIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { trpc } from '@/app/trpc';
import { Spinner } from '@/components/spinner';
import { useDeleteLinks } from '@/lib/hooks/link-mutations';
import { useMergeRecords } from '@/lib/hooks/record-mutations';
import { usePredicateMap, useRecordLinks } from '@/lib/hooks/record-queries';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { cn } from '@/lib/utils';
import { exhaustive } from '@/shared/lib/type-utils';
import type { DbId } from '@/shared/types/api';
import type { LinkPartial } from '@/shared/types/domain';
import { RecordLink } from './record-link';
import { RelationshipSelector } from './record-lookup';

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
  isAdmin: boolean;
}

export const RelationsList = ({ id, isAdmin }: RelationsListProps) => {
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

  const sortLinks = (links: LinkPartial[]): LinkPartial[] => {
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
  };

  const outgoingLinks = useMemo(
    () =>
      sortLinks(
        recordLinks?.outgoingLinks.filter(
          (link) => predicates[link.predicate]?.type !== 'containment'
        ) ?? []
      ),
    [recordLinks, predicates]
  );
  const incomingLinks = useMemo(
    () =>
      sortLinks(
        recordLinks?.incomingLinks.filter(
          (link) => predicates[link.predicate]?.type !== 'containment'
        ) ?? []
      ),
    [recordLinks, predicates]
  );
  const totalLinks = useMemo(
    () => outgoingLinks.length + incomingLinks.length,
    [outgoingLinks, incomingLinks]
  );

  return (
    <section>
      <header className="flex items-center justify-between overflow-hidden">
        <h3 className="mb-2">
          Relations <span className="text-sm text-c-secondary">({totalLinks})</span>
        </h3>
        {isAdmin && (
          <RelationshipSelector
            sourceId={id}
            label={
              <span>
                <PlusIcon /> Add
              </span>
            }
            buttonProps={{
              ref: addRelationshipButtonRef,
              size: 'sm',
              variant: 'outline',
              className: 'h-[1.5lh]',
            }}
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
          />
        )}
      </header>
      {outgoingLinks.length > 0 && (
        <>
          <h4 className="mb-2 flex items-center gap-2 font-mono text-sm font-semibold text-c-secondary uppercase">
            <ArrowRightIcon className="size-4 text-c-hint" /> Outgoing
          </h4>
          <ul className="flex flex-col gap-2 text-xs">
            {outgoingLinks.map((link) => (
              <li
                key={`${link.sourceId}-${link.targetId}-${link.predicate}`}
                className="flex items-center gap-2"
              >
                {isAdmin ? (
                  <RelationshipSelector
                    label={predicates[link.predicate]?.name ?? 'Unknown'}
                    sourceId={link.sourceId}
                    initialTargetId={link.targetId}
                    link={link}
                    buttonProps={{
                      className: 'w-30',
                    }}
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
                  />
                ) : (
                  <span className="inline-flex w-30 items-center text-sm font-medium text-c-secondary capitalize">
                    {predicates[link.predicate]?.name ?? 'Unknown'}
                  </span>
                )}
                <RecordLink
                  id={link.targetId}
                  linkOptions={{
                    to: '/records/$recordId',
                    params: { recordId: link.targetId },
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {incomingLinks.length > 0 && (
        <>
          <h4
            className={cn(
              'mb-2 flex items-center gap-2 font-mono text-sm font-semibold text-c-hint uppercase',
              outgoingLinks.length > 0 && 'mt-3'
            )}
          >
            <ArrowLeftIcon className="h-4 w-4" /> Incoming
          </h4>
          <ul className="flex flex-col gap-2 text-xs">
            {incomingLinks.map((link) => {
              const incomingLabel = (() => {
                const inv = predicates[link.predicate]?.inverseSlug;
                return inv
                  ? (PREDICATES[inv as keyof typeof PREDICATES]?.name ?? 'Unknown')
                  : (predicates[link.predicate]?.name ?? 'Unknown');
              })();
              return (
                <li
                  key={`${link.sourceId}-${link.targetId}-${link.predicate}`}
                  className="flex items-center gap-2"
                >
                  {isAdmin ? (
                    <RelationshipSelector
                      label={incomingLabel}
                      sourceId={link.targetId}
                      initialTargetId={link.sourceId}
                      incoming
                      link={link}
                      buttonProps={{
                        className: 'w-30',
                      }}
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
                    />
                  ) : (
                    <span className="inline-flex w-30 items-center text-sm font-medium text-c-secondary capitalize">
                      {incomingLabel}
                    </span>
                  )}
                  <RecordLink
                    id={link.sourceId}
                    linkOptions={{
                      to: '/records/$recordId',
                      params: { recordId: link.sourceId },
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};

export const SimilarRecords = ({ id, isAdmin }: { id: DbId; isAdmin: boolean }) => {
  const navigate = useNavigate();
  const mergeRecordsMutation = useMergeRecords();

  // Fetch similar records only if textEmbedding exists
  const { data: similarRecords, isLoading } = trpc.search.byRecordId.useQuery(
    {
      id: id,
      limit: 20,
    },
    {
      trpc: {
        context: {
          skipBatch: true,
        },
      },
    }
  );

  return (
    <section className="text-xs">
      <h3 className="mb-2">Similar Records</h3>
      {isLoading ? (
        <Spinner />
      ) : similarRecords && similarRecords.length > 0 ? (
        <ul>
          {similarRecords.map((record) => (
            <li key={record.id} className="mb-2 flex items-center gap-4">
              {isAdmin ? (
                <RelationshipSelector
                  sourceId={id}
                  initialTargetId={record.id}
                  label={`${Math.round(record.similarity * 100)}%`}
                  buttonProps={{
                    size: 'sm',
                    variant: 'outline',
                    className: 'h-[1.5lh] font-mono text-xs text-c-secondary',
                  }}
                  popoverProps={{ side: 'left' }}
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
                />
              ) : (
                <span className="inline-flex h-[1.5lh] items-center font-mono text-xs text-c-secondary">
                  {Math.round(record.similarity * 100)}%
                </span>
              )}
              <RecordLink
                id={record.id}
                className="flex-1"
                linkOptions={{
                  to: '/records/$recordId',
                  params: { recordId: record.id },
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>No similar records found.</p>
      )}
    </section>
  );
};
