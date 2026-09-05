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
import type { ReadwiseCleanupChange, ReadwiseCleanupPreview } from '@/shared/readwise-cleanup';
import { css } from '@/styled-system/css';
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

const Note = styled('p', { base: { textStyle: 'sm', color: 'secondary' } });
const Column = styled('div', {
  base: { display: 'flex', flexDirection: 'column', gap: '2', minWidth: '0' },
});
const passage = css.raw({ textStyle: 'sm', overflowWrap: 'anywhere' });

const sourceLabels = {
  document: 'Source reconstruction',
  model: 'Editorial correction',
  readwise: 'Readwise formatting',
};

const unbatched = { trpc: { context: { skipBatch: true } } };

type Entry = { change: ReadwiseCleanupChange; checked: boolean; originals?: Entry[] };

const recordIds = (change: ReadwiseCleanupChange) => [
  change.target.id,
  ...change.merged.map((record) => record.id),
];

function canMerge(left: Entry, right: Entry, pairs: ReadwiseCleanupPreview['mergeable']) {
  const leftIds = recordIds(left.change);
  const rightIds = recordIds(right.change);
  return (
    !leftIds.some((id) => rightIds.includes(id)) &&
    pairs.some(
      ([first, second]) =>
        (leftIds.includes(first) && rightIds.includes(second)) ||
        (leftIds.includes(second) && rightIds.includes(first))
    )
  );
}

export function ReadwiseCleanup({ recordId }: { recordId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editorial, setEditorial] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mergingId, setMergingId] = useState<number>();
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
      onSuccess: ({ updatedRecordIds, deletedRecordIds, snapshot }, { changes }) => {
        for (const change of changes) {
          for (const record of change.merged) {
            if (deletedRecordIds.includes(record.id)) replaceBasketId(record.id, change.target.id);
          }
        }
        for (const id of [recordId, ...updatedRecordIds, ...deletedRecordIds]) {
          void queryClient.invalidateQueries(trpc.search.byRecordId.queryFilter({ id }));
        }
        const survivor = changes.find((change) =>
          change.merged.some((record) => record.id === recordId)
        )?.target.id;
        if (survivor !== undefined) {
          void navigate({ to: '/records/$recordId', params: { recordId: survivor } });
        }
        setOpen(false);
        toast('Readwise highlights cleaned up', {
          action: {
            label: 'Undo',
            onClick: () => {
              void undoMutation.mutateAsync({ snapshot }).then(() => {
                if (survivor !== undefined) {
                  void navigate({ to: '/records/$recordId', params: { recordId } });
                }
              });
            },
          },
          duration: 15_000,
        });
      },
    })
  );
  const preview = previewQuery.data;
  const selected = entries.filter((entry) => entry.checked).map((entry) => entry.change);
  const unchangedCount = entries.filter((entry) => !entry.change.changed).length;
  const applying = applyMutation.isPending;
  const busy = previewQuery.isFetching || mergingId !== undefined || applying;

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
      if (data) setEntries(data.changes.map((change) => ({ change, checked: change.changed })));
    });
  };

  const handleMerge = (left: Entry, right: Entry) => {
    setMergingId(left.change.target.id);
    queryClient
      .query(
        trpc.records.previewReadwiseCleanup.queryOptions(
          {
            id: recordId,
            editorial,
            merge: [...recordIds(left.change), ...recordIds(right.change)],
          },
          unbatched
        )
      )
      .then((merged) => {
        const [change] = merged.changes;
        if (!change) return;
        const entry: Entry = {
          change: { ...change, warnings: [...new Set([...change.warnings, ...merged.issues])] },
          checked: true,
          originals: [left, right],
        };
        setEntries((current) =>
          current.flatMap((item) => {
            if (item === left) return [entry];
            return item === right ? [] : [item];
          })
        );
      })
      .catch(() => undefined)
      .finally(() => setMergingId(undefined));
  };

  const handleUnmerge = (entry: Entry) => {
    setEntries((current) =>
      current.flatMap((item) => (item === entry ? (entry.originals ?? [entry]) : [item]))
    );
  };

  const handleSelectionChange = (entry: Entry, checked: boolean) => {
    setEntries((current) => current.map((item) => (item === entry ? { ...item, checked } : item)));
  };

  const handleApply = () => {
    applyMutation.mutate({ changes: selected });
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
            Review the suggested changes. Highlights stay separate unless you merge them. Nothing
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
          {preview ? (
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
                  <Note>
                    The original document was unavailable. Review the Readwise-based changes
                    carefully.
                  </Note>
                )}
              </styled.header>
              {preview.issues.length > 0 && <Warnings warnings={preview.issues} />}
              {entries.map((entry, index) => {
                const next = entries[index + 1];
                return (
                  <CleanupEntry
                    key={entry.change.target.id}
                    entry={entry}
                    merging={mergingId === entry.change.target.id}
                    disabled={busy}
                    onSelectionChange={handleSelectionChange}
                    onMerge={
                      next && canMerge(entry, next, preview.mergeable)
                        ? () => handleMerge(entry, next)
                        : undefined
                    }
                    onUnmerge={handleUnmerge}
                  />
                );
              })}
              {entries.length === unchangedCount ? (
                <Note>No cleanup changes were found.</Note>
              ) : (
                unchangedCount > 0 && (
                  <Note>
                    {unchangedCount === 1
                      ? '1 highlight needs no changes.'
                      : `${unchangedCount} highlights need no changes.`}
                  </Note>
                )
              )}
            </>
          ) : (
            <Label>
              <Checkbox checked={editorial} onCheckedChange={setEditorial} disabled={busy}>
                <BaseCheckbox.Indicator>
                  <CheckIcon />
                </BaseCheckbox.Indicator>
              </Checkbox>
              Check spelling and grammar
            </Label>
          )}
        </styled.div>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={handleApply} disabled={busy || selected.length === 0}>
              {applying && <Spinner />}
              Apply selected ({selected.length})
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

function CleanupEntry({
  entry,
  merging,
  disabled,
  onSelectionChange,
  onMerge,
  onUnmerge,
}: {
  entry: Entry;
  merging: boolean;
  disabled: boolean;
  onSelectionChange: (entry: Entry, checked: boolean) => void;
  onMerge: (() => void) | undefined;
  onUnmerge: (entry: Entry) => void;
}) {
  const { change, checked } = entry;
  const id = change.target.id;
  const before = [change.target, ...change.merged];

  return (
    <>
      <styled.section
        aria-label={`Highlight ${id}`}
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
          {change.changed ? (
            <Label>
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => onSelectionChange(entry, next)}
                disabled={disabled}
              >
                <BaseCheckbox.Indicator>
                  <CheckIcon />
                </BaseCheckbox.Indicator>
              </Checkbox>
              {sourceLabels[change.source]}
              {change.merged.length > 0 && ` · Merge ${before.length} highlights`}
            </Label>
          ) : (
            <Note>Highlight {id} · No changes suggested</Note>
          )}
          {entry.originals && (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onUnmerge(entry)}>
              Undo merge
            </Button>
          )}
        </styled.header>
        {change.changed && change.reasons.length > 0 && (
          <styled.ul css={{ display: 'flex', flexDirection: 'column', gap: '1', textStyle: 'sm' }}>
            {change.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </styled.ul>
        )}
        {change.warnings.length > 0 && <Warnings warnings={change.warnings} />}
        {change.merged.length > 0 && (
          <styled.p css={{ textStyle: 'xs', color: 'secondary' }}>
            Keep highlight {id} with the merged text, notes, links, and media.
          </styled.p>
        )}
        {change.changed ? (
          <styled.div
            css={{
              display: 'grid',
              gap: '4',
              '@container (min-width: 40rem)': {
                gridTemplateColumns: '[repeat(2, minmax(0, 1fr))]',
              },
            }}
          >
            <Column>
              {before.map((record) => (
                <styled.article
                  key={record.id}
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
                      Highlight {record.id}
                    </styled.span>
                  </styled.h4>
                  <Markdown css={passage}>{record.content ?? ''}</Markdown>
                </styled.article>
              ))}
            </Column>
            <Column>
              <styled.h4 css={{ textStyle: 'sm', fontWeight: 'semibold' }}>After</styled.h4>
              <Markdown css={passage}>{change.content}</Markdown>
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
            </Column>
          </styled.div>
        ) : (
          <Markdown css={passage}>{change.content}</Markdown>
        )}
      </styled.section>
      {onMerge && (
        <Button
          variant="outline"
          size="sm"
          css={{ alignSelf: 'center' }}
          disabled={disabled}
          onClick={onMerge}
        >
          {merging && <Spinner />}
          {merging ? 'Merging highlights' : 'Merge highlights'}
        </Button>
      )}
    </>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
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
