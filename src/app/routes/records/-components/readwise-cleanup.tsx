import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CheckIcon, EraserIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTRPC } from '@/app/trpc';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { ExternalLink } from '@/components/external-link';
import { Label } from '@/components/label';
import { Markdown } from '@/components/markdown';
import { Spinner } from '@/components/spinner';
import { Tooltip } from '@/components/tooltip';
import { replaceBasketId } from '@/lib/hooks/use-basket';
import {
  canCombineReadwiseChanges,
  hasReadwiseCleanupChanges,
  type ReadwiseCleanupChange,
} from '@/shared/readwise-cleanup';
import { styled } from '@/styled-system/jsx';

const Checkbox = styled(BaseCheckbox.Root, {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    boxSize: '4',
    borderRadius: 'sm',
    borderWidth: '1px',
    borderColor: 'border',
    backgroundColor: 'surface',
    cursor: 'pointer',
    _checked: { backgroundColor: 'main', borderColor: 'main', color: 'mainContrast' },
    _focusVisible: {
      outlineColor: 'focus',
      outlineOffset: '0.5',
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
    _disabled: { opacity: '50%', cursor: 'default' },
    _childIcon: { boxSize: '3' },
  },
});

const sourceLabels = {
  readwise: 'Readwise formatting',
  document: 'Source reconstruction',
  model: 'Editorial correction',
};

const unbatched = { trpc: { context: { skipBatch: true } } };

type CleanupEntry = {
  change: ReadwiseCleanupChange;
  checked: boolean;
  originals?: CleanupEntry[];
};

export function ReadwiseCleanup({ recordId }: { recordId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editorial, setEditorial] = useState(true);
  const [entries, setEntries] = useState<CleanupEntry[]>([]);
  const [combiningRecordId, setCombiningRecordId] = useState<number>();
  const previewQuery = useQuery(
    trpc.records.previewReadwiseCleanup.queryOptions(
      { id: recordId, editorial },
      { ...unbatched, enabled: false }
    )
  );
  const undoMutation = useMutation(
    trpc.records.undoReadwiseCleanup.mutationOptions({
      onSuccess: ({ restoredRecordIds }) => {
        for (const id of restoredRecordIds) {
          void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id }));
        }
        toast.success('Readwise cleanup undone');
      },
    })
  );
  const applyMutation = useMutation(
    trpc.records.applyReadwiseCleanup.mutationOptions({
      onSuccess: ({ updatedRecordIds, deletedRecordIds, snapshot }, { preview }) => {
        for (const change of preview.changes) {
          const [targetId] = change.recordIds;
          if (!updatedRecordIds.includes(targetId)) continue;
          for (const sourceId of change.recordIds) {
            if (deletedRecordIds.includes(sourceId)) replaceBasketId(sourceId, targetId);
          }
        }
        for (const id of [recordId, ...updatedRecordIds, ...deletedRecordIds]) {
          void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id }));
        }
        const deleted = deletedRecordIds.includes(recordId);
        if (deleted) {
          const target = preview.changes.find((change) => change.recordIds.includes(recordId));
          void navigate({
            to: '/records/$recordId',
            params: { recordId: target?.recordIds[0] ?? preview.recordId },
          });
        }
        setOpen(false);
        toast('Readwise highlights cleaned up', {
          action: {
            label: 'Undo',
            onClick: () => {
              void undoMutation.mutateAsync({ snapshot }).then(() => {
                if (deleted) void navigate({ to: '/records/$recordId', params: { recordId } });
              });
            },
          },
          duration: 15_000,
        });
      },
    })
  );
  const preview = previewQuery.data;
  const updates = entries.filter(({ change }) => hasReadwiseCleanupChanges(change));
  const selectedRecordIds = updates.flatMap(({ change, checked }) =>
    checked ? [change.recordIds[0]] : []
  );
  const unchangedCount =
    preview?.unchangedRecordIds.filter(
      (id) => !updates.some(({ change }) => change.recordIds.includes(id))
    ).length ?? 0;
  const applying = applyMutation.isPending;
  const busy = previewQuery.isFetching || combiningRecordId !== undefined || applying;

  const handleOpenChange = (nextOpen: boolean) => {
    if (applying) return;
    const previewFilter = trpc.records.previewReadwiseCleanup.queryFilter();
    if (nextOpen) {
      queryClient.removeQueries(previewFilter);
      setEditorial(true);
      setEntries([]);
    } else {
      void queryClient.cancelQueries(previewFilter);
    }
    setOpen(nextOpen);
  };

  const handlePreview = () => {
    void previewQuery.refetch().then(({ data }) => {
      if (data) {
        setEntries(
          data.changes.map((change) => ({ change, checked: hasReadwiseCleanupChanges(change) }))
        );
      }
    });
  };

  const handleCombine = (left: CleanupEntry, right: CleanupEntry) => {
    setCombiningRecordId(left.change.recordIds[0]);
    queryClient
      .query(
        trpc.records.combineReadwiseCleanup.queryOptions(
          {
            id: recordId,
            recordIds: [...left.change.recordIds, ...right.change.recordIds],
            editorial,
          },
          unbatched
        )
      )
      .then((change) => {
        setEntries((current) =>
          current.flatMap((entry) => {
            if (entry === left) return [{ change, checked: true, originals: [left, right] }];
            return entry === right ? [] : [entry];
          })
        );
      })
      .catch(() => undefined)
      .finally(() => setCombiningRecordId(undefined));
  };

  const handleUndoCombine = (entry: CleanupEntry) => {
    setEntries((current) =>
      current.flatMap((item) => (item === entry ? (entry.originals ?? [entry]) : [item]))
    );
  };

  const handleApply = () => {
    if (preview) {
      applyMutation.mutate({
        preview: { ...preview, changes: entries.map(({ change }) => change) },
        recordIds: selectedRecordIds,
      });
    }
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const handleSelectionChange = (entry: CleanupEntry, checked: boolean) => {
    setEntries((current) => current.map((item) => (item === entry ? { ...entry, checked } : item)));
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Dialog.Trigger
              render={
                <Button size="icon" variant="ghost" aria-label="Clean up Readwise highlights">
                  <EraserIcon />
                </Button>
              }
            />
          }
        />
        <Tooltip.Content>Clean up Readwise highlights</Tooltip.Content>
      </Tooltip.Root>
      <Dialog.Content
        showCloseButton={!applying}
        css={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '[85dvh]',
          sm: { maxWidth: '256' },
        }}
      >
        <Dialog.Header>
          <Dialog.Title>Clean up Readwise highlights</Dialog.Title>
          <Dialog.Description>
            Review the suggested changes. Highlights stay separate unless you combine them. Nothing
            changes until you apply your selections.
          </Dialog.Description>
        </Dialog.Header>
        <styled.div
          css={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4',
            minHeight: '0',
            overflowY: 'auto',
            containerType: 'inline-size',
          }}
        >
          {!preview && (
            <Label>
              <Checkbox checked={editorial} onCheckedChange={setEditorial} disabled={busy}>
                <BaseCheckbox.Indicator>
                  <CheckIcon />
                </BaseCheckbox.Indicator>
              </Checkbox>
              Check spelling and grammar
            </Label>
          )}
          {preview && (
            <>
              <styled.header css={{ display: 'flex', flexDirection: 'column', gap: '1' }}>
                <styled.h3 css={{ textStyle: 'base', fontWeight: 'semibold' }}>
                  {preview.title ?? 'Readwise document'}
                </styled.h3>
                {preview.sourceUrl && (
                  <ExternalLink href={preview.sourceUrl} css={{ textStyle: 'sm' }}>
                    Open source document
                  </ExternalLink>
                )}
                {!preview.sourceAvailable && (
                  <styled.p css={{ textStyle: 'sm', color: 'secondary' }}>
                    The original document was unavailable. Review the Readwise-based changes
                    carefully.
                  </styled.p>
                )}
              </styled.header>
              {preview.issues.length > 0 && <CleanupWarnings warnings={preview.issues} />}
              {entries.map((entry, index) => {
                const [id] = entry.change.recordIds;
                const nextEntry = entries[index + 1];
                return (
                  <CleanupChange
                    key={id}
                    entry={entry}
                    nextEntry={nextEntry}
                    recordId={id}
                    canCombine={
                      nextEntry !== undefined &&
                      canCombineReadwiseChanges(
                        entry.change,
                        nextEntry.change,
                        preview.combinablePairs
                      )
                    }
                    combining={combiningRecordId === id}
                    disabled={busy}
                    onSelectionChange={handleSelectionChange}
                    onCombine={handleCombine}
                    onUndoCombine={handleUndoCombine}
                  />
                );
              })}
              {updates.length === 0 ? (
                <styled.p css={{ textStyle: 'sm', color: 'secondary' }}>
                  No cleanup changes were found.
                </styled.p>
              ) : (
                unchangedCount > 0 && (
                  <styled.p css={{ textStyle: 'sm', color: 'secondary' }}>
                    {unchangedCount === 1
                      ? '1 highlight needs no changes.'
                      : `${unchangedCount} highlights need no changes.`}
                  </styled.p>
                )
              )}
            </>
          )}
        </styled.div>
        <Dialog.Footer>
          <Button variant="outline" onClick={handleCancel} disabled={applying}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={handleApply} disabled={busy || selectedRecordIds.length === 0}>
              {applying && <Spinner />}
              Apply selected ({selectedRecordIds.length})
            </Button>
          ) : (
            <Button onClick={handlePreview} disabled={busy}>
              {previewQuery.isFetching && <Spinner />}
              {previewQuery.isFetching ? 'Preparing preview' : 'Preview changes'}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function CleanupChange({
  entry,
  nextEntry,
  recordId,
  canCombine,
  combining,
  disabled,
  onSelectionChange,
  onCombine,
  onUndoCombine,
}: {
  entry: CleanupEntry;
  nextEntry: CleanupEntry | undefined;
  recordId: number;
  canCombine: boolean;
  combining: boolean;
  disabled: boolean;
  onSelectionChange: (entry: CleanupEntry, checked: boolean) => void;
  onCombine: (left: CleanupEntry, right: CleanupEntry) => void;
  onUndoCombine: (entry: CleanupEntry) => void;
}) {
  const { change, checked } = entry;
  const hasChanges = hasReadwiseCleanupChanges(change);
  const handleCheckedChange = (nextChecked: boolean) => {
    onSelectionChange(entry, nextChecked);
  };
  const handleCombine = () => {
    if (nextEntry) onCombine(entry, nextEntry);
  };
  const handleUndoCombine = () => {
    onUndoCombine(entry);
  };

  return (
    <>
      <styled.section
        aria-label={`Highlight ${recordId}`}
        css={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          padding: '4',
          borderRadius: 'md',
          border: 'divider',
        }}
      >
        <styled.header
          css={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2',
          }}
        >
          {hasChanges ? (
            <Label>
              <Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled}>
                <BaseCheckbox.Indicator>
                  <CheckIcon />
                </BaseCheckbox.Indicator>
              </Checkbox>
              {sourceLabels[change.source]}
              {change.recordIds.length > 1 && ` · Combine ${change.recordIds.length} highlights`}
            </Label>
          ) : (
            <styled.p css={{ textStyle: 'sm', color: 'secondary' }}>
              Highlight {recordId} · No changes suggested
            </styled.p>
          )}
          {entry.originals && (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={handleUndoCombine}>
              Undo combine
            </Button>
          )}
        </styled.header>
        {hasChanges && change.reasons.length > 0 && (
          <styled.ul css={{ display: 'flex', flexDirection: 'column', gap: '1', textStyle: 'sm' }}>
            {change.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </styled.ul>
        )}
        {change.warnings.length > 0 && <CleanupWarnings warnings={change.warnings} />}
        {change.recordIds.length > 1 && (
          <styled.p css={{ textStyle: 'xs', color: 'secondary' }}>
            Keep highlight {recordId} with the combined text, notes, links, and media.
          </styled.p>
        )}
        {hasChanges ? (
          <styled.div
            css={{
              display: 'grid',
              gap: '4',
              '@container (min-width: 40rem)': {
                gridTemplateColumns: '[repeat(2, minmax(0, 1fr))]',
              },
            }}
          >
            <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '2', minWidth: '0' }}>
              {change.before.map((original) => (
                <styled.article
                  key={original.id}
                  css={{ display: 'flex', flexDirection: 'column', gap: '2' }}
                >
                  <styled.h4
                    css={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '2',
                      textStyle: 'sm',
                      fontWeight: 'semibold',
                    }}
                  >
                    Before
                    <styled.span
                      css={{ textStyle: 'xs', fontWeight: 'normal', color: 'secondary' }}
                    >
                      Highlight {original.id}
                    </styled.span>
                  </styled.h4>
                  <Markdown css={{ textStyle: 'sm', overflowWrap: 'anywhere' }}>
                    {original.content ?? ''}
                  </Markdown>
                </styled.article>
              ))}
            </styled.div>
            <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '2', minWidth: '0' }}>
              <styled.h4 css={{ textStyle: 'sm', fontWeight: 'semibold' }}>After</styled.h4>
              <Markdown css={{ textStyle: 'sm', overflowWrap: 'anywhere' }}>
                {change.content}
              </Markdown>
              {change.images.length > 0 && (
                <>
                  <styled.h5 css={{ textStyle: 'xs', fontWeight: 'semibold' }}>
                    Recovered images
                  </styled.h5>
                  <styled.ul
                    css={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1',
                      textStyle: 'sm',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {change.images.map((image) => (
                      <li key={image.url}>
                        <ExternalLink href={image.url}>{image.altText || image.url}</ExternalLink>
                      </li>
                    ))}
                  </styled.ul>
                </>
              )}
            </styled.div>
          </styled.div>
        ) : (
          <Markdown css={{ textStyle: 'sm', overflowWrap: 'anywhere' }}>{change.content}</Markdown>
        )}
      </styled.section>
      {canCombine && (
        <Button
          variant="outline"
          size="sm"
          css={{ alignSelf: 'center' }}
          disabled={disabled}
          onClick={handleCombine}
        >
          {combining && <Spinner />}
          {combining ? 'Combining highlights' : 'Combine highlights'}
        </Button>
      )}
    </>
  );
}

function CleanupWarnings({ warnings }: { warnings: string[] }) {
  return (
    <styled.ul
      css={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1',
        padding: '3',
        textStyle: 'sm',
        palette: 'info',
        chromatic: true,
        backgroundColor: 'splash',
        borderRadius: 'md',
      }}
    >
      {warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </styled.ul>
  );
}
