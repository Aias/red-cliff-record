import type { RecordType } from '@hozo/schema/records.shared';
import { useForm } from '@tanstack/react-form';
import { useRouterState } from '@tanstack/react-router';
import { BadgeCheckIcon, BadgeIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ExternalLink } from '@/components/external-link';
import { GhostInput } from '@/components/input';
import { Label } from '@/components/label';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
import { Spinner } from '@/components/spinner';
import { Table } from '@/components/table';
import { DynamicTextarea } from '@/components/textarea';
import { Toggle } from '@/components/toggle';
import { ToggleGroup } from '@/components/toggle-group';
import { Tooltip } from '@/components/tooltip';
import { useDeleteMedia } from '@/lib/hooks/media-mutations';
import { useUpdateRecord } from '@/lib/hooks/record-mutations';
import { useRecord, type RecordData } from '@/lib/hooks/record-queries';
import { addToBasket, removeFromBasket, useInBasket } from '@/lib/hooks/use-basket';
import { useRecordUpload } from '@/lib/hooks/use-record-upload';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import type { UpdateRecordInput } from '@/shared/zero/mutators';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { Metabar } from './record-metabar';
import { recordTypeIcons, recordTypeOrder } from './type-icons';

interface RecordFormProps extends React.HTMLAttributes<HTMLFormElement> {
  recordId: number;
  onFinalize: () => void;
  onDelete?: () => void;
}

/** The editable subset of a record the form manages. */
type RecordFormValues = {
  type: RecordType;
  title: string | null;
  sense: string | null;
  abbreviation: string | null;
  url: string | null;
  summary: string | null;
  content: string | null;
  notes: string | null;
  mediaCaption: string | null;
  isCurated: boolean;
  isPrivate: boolean;
};

const defaultData: RecordFormValues = {
  type: 'artifact',
  title: null,
  sense: null,
  abbreviation: null,
  url: null,
  summary: null,
  content: null,
  notes: null,
  mediaCaption: null,
  isCurated: false,
  isPrivate: false,
};

/** How long typing must pause before the pending changes commit. */
const COMMIT_DEBOUNCE_MS = 300;

function valuesFromRecord(record: RecordData): RecordFormValues {
  return {
    type: record.type,
    title: record.title,
    sense: record.sense,
    abbreviation: record.abbreviation,
    url: record.url,
    summary: record.summary,
    content: record.content,
    notes: record.notes,
    mediaCaption: record.mediaCaption,
    isCurated: record.isCurated,
    isPrivate: record.isPrivate,
  };
}

/** Normalize form values to their stored shape (empty strings become null). */
function normalizeValues(values: RecordFormValues): RecordFormValues {
  return {
    ...values,
    title: values.title || null,
    sense: values.sense || null,
    abbreviation: values.abbreviation || null,
    url: values.url || null,
    summary: values.summary || null,
    content: values.content || null,
    notes: values.notes || null,
    mediaCaption: values.mediaCaption || null,
  };
}

/**
 * Fields where `next` diverges from the committed baseline. A malformed URL is
 * held back (the field validator surfaces the error) until it parses or clears.
 */
function collectChanges(
  next: RecordFormValues,
  base: RecordFormValues
): Omit<UpdateRecordInput, 'id'> {
  const changes: Omit<UpdateRecordInput, 'id'> = {};
  if (next.type !== base.type) changes.type = next.type;
  if (next.isCurated !== base.isCurated) changes.isCurated = next.isCurated;
  if (next.isPrivate !== base.isPrivate) changes.isPrivate = next.isPrivate;
  if (next.title !== base.title) changes.title = next.title;
  if (next.sense !== base.sense) changes.sense = next.sense;
  if (next.abbreviation !== base.abbreviation) changes.abbreviation = next.abbreviation;
  if (next.summary !== base.summary) changes.summary = next.summary;
  if (next.content !== base.content) changes.content = next.content;
  if (next.notes !== base.notes) changes.notes = next.notes;
  if (next.mediaCaption !== base.mediaCaption) changes.mediaCaption = next.mediaCaption;
  if (next.url !== base.url && (next.url === null || z.url().safeParse(next.url).success)) {
    changes.url = next.url;
  }
  return changes;
}

export function RecordForm({
  recordId,
  onFinalize,
  onDelete,
  className,
  ...props
}: RecordFormProps) {
  const routerState = useRouterState({ select: (s) => s.location.state });
  const { data: record, isLoading, isError } = useRecord(recordId);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);
  const mediaUploadRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus title input when navigating with focusForm state
  const shouldFocus = routerState?.focusForm;

  useEffect(() => {
    if (shouldFocus && !isLoading && titleInputRef.current) {
      // Use double rAF to ensure DOM is ready after loading state clears
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          titleInputRef.current?.focus();
        });
      });
    }
  }, [shouldFocus, isLoading]);

  const formData: RecordFormValues = record ? valuesFromRecord(record) : defaultData;
  const isFormLoading = isLoading || !record;

  const inBasket = useInBasket(recordId);
  const updateRecord = useUpdateRecord();
  const deleteMediaMutation = useDeleteMedia();
  const { uploadFile, isUploading } = useRecordUpload(recordId);

  const form = useForm({ defaultValues: formData });

  /* Baseline for diffing commits: the last state written to (or read from)
   * the synced record. null until the record first loads. */
  const lastCommittedRef = useRef<RecordFormValues | null>(null);

  /** Write fields that changed since the last commit to the synced record. */
  const commit = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const base = lastCommittedRef.current;
    if (!base) return;
    const changes = collectChanges(normalizeValues(form.state.values), base);
    if (Object.keys(changes).length === 0) return;
    lastCommittedRef.current = { ...base, ...changes };
    await updateRecord({ id: recordId, ...changes });
  }, [form, recordId, updateRecord]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => void commit(), COMMIT_DEBOUNCE_MS);
  }, [commit]);

  /* Sync the synced record into the form: seed once it loads, then absorb
   * external edits (another tab, the CLI, enrichment). Echoes of this form's
   * own commits match the baseline and no-op; while a commit is pending, the
   * in-flight local edits win. */
  useEffect(() => {
    if (!record) return;
    const synced = valuesFromRecord(record);
    const base = lastCommittedRef.current;
    lastCommittedRef.current = synced;
    if (!base) {
      form.reset(synced);
      return;
    }
    if (saveTimeoutRef.current) return;
    if (Object.keys(collectChanges(synced, base)).length > 0) {
      form.reset(synced);
    }
  }, [record, form]);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  /* Flush any pending commit when the form unmounts or the tab closes.
   * beforeunload cannot await, but firing the mutation lets Zero enqueue it. */
  useEffect(() => {
    const flush = () => void commitRef.current();
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  const curateAndNextHandler = useCallback(async () => {
    form.setFieldValue('isCurated', true);
    await commit();
    onFinalize();
  }, [form, commit, onFinalize]);

  // Register keyboard shortcuts
  useKeyboardShortcut('mod+shift+enter', () => void curateAndNextHandler(), {
    description: 'Curate and go to next record',
    category: 'Records',
    allowInInput: true,
  });

  useKeyboardShortcut(
    'mod+b',
    () => {
      if (inBasket) {
        removeFromBasket(recordId);
        toast.success('Removed from basket');
      } else {
        addToBasket(recordId);
        toast.success('Added to basket');
      }
    },
    {
      description: 'Toggle record in basket',
      category: 'Records',
      allowInInput: true,
    }
  );

  // Form-level paste handler for media uploads
  // Works regardless of whether MediaUpload component is visible
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLFormElement>) => {
      if (isUploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (
          item.kind === 'file' &&
          (item.type.startsWith('image/') || item.type.startsWith('video/'))
        ) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void uploadFile(file);
            return;
          }
        }
      }
    },
    [uploadFile, isUploading]
  );

  if (isError) return <div>Error loading record</div>;

  return (
    <styled.form
      ref={formRef}
      key={recordId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void commit();
      }}
      onKeyDown={(e) => {
        // Escape blurs the currently focused element (first escape unfocuses field)
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
      }}
      onPaste={handlePaste}
      className={className}
      css={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      {...props}
    >
      {isFormLoading && (
        <styled.div
          css={{
            position: 'absolute',
            inset: '0',
            zIndex: '10',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'lg',
            backgroundColor: 'container/50',
            backdropBlur: 'sm',
          }}
        >
          <Spinner />
        </styled.div>
      )}
      <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '4' }}>
        <styled.h1 css={{ display: 'flex', alignItems: 'center', gap: '3' }}>
          <form.Field name="title">
            {(field) => (
              <styled.div css={{ flexGrow: '1' }}>
                <GhostInput
                  aria-label="Record title"
                  ref={titleInputRef}
                  value={field.value ?? ''}
                  placeholder="Untitled Record"
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    debouncedSave();
                  }}
                  onBlur={() => void commit()}
                  readOnly={isFormLoading}
                  className={css({
                    color: 'display',
                    _placeholder: { fontWeight: 'medium' },
                  })}
                />
                {field.meta.isInvalid && (
                  <styled.p
                    css={{
                      palette: 'error',
                      chromatic: true,
                      textStyle: 'sm',
                    }}
                  >
                    {field.errors.map((error) => error.message).join(', ')}
                  </styled.p>
                )}
              </styled.div>
            )}
          </form.Field>
        </styled.h1>

        <styled.div
          css={{
            containerType: 'inline-size',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          }}
        >
          <form.Field name="type">
            {(field) => {
              type TypeTooltipPayload = {
                type: RecordType;
                description: string;
              };
              const handle = Tooltip.createHandle<TypeTooltipPayload>();
              return (
                <ToggleGroup.Root
                  value={field.value ? [field.value] : []}
                  onValueChange={(groupValue) => {
                    const value = groupValue[0];
                    if (value) {
                      field.handleChange(value);
                      debouncedSave();
                    }
                  }}
                  variant="outline"
                  css={{ flexGrow: '1' }}
                  disabled={isFormLoading}
                >
                  {recordTypeOrder.map((type) => {
                    const { icon: Icon, description } = recordTypeIcons[type];
                    return (
                      <Tooltip.Trigger
                        key={type}
                        handle={handle}
                        payload={{ type, description }}
                        render={
                          <ToggleGroup.Item
                            value={type}
                            aria-label={type}
                            css={{
                              display: 'flex',
                              flexGrow: '1',
                              alignItems: 'center',
                              gap: '1',
                            }}
                          >
                            <Icon />
                            <styled.span
                              css={{
                                display: 'none',
                                textTransform: 'capitalize',
                                '@container (min-width: 30rem)': {
                                  display: 'inline',
                                },
                              }}
                            >
                              {type}
                            </styled.span>
                          </ToggleGroup.Item>
                        }
                      />
                    );
                  })}
                  <Tooltip.Root handle={handle}>
                    {({ payload }) =>
                      payload !== undefined ? (
                        <Tooltip.Content side="bottom">
                          <p>
                            <styled.strong
                              css={{
                                marginInlineEnd: '1',
                                textTransform: 'capitalize',
                              }}
                            >
                              {payload.type}
                            </styled.strong>
                            {payload.description}
                          </p>
                        </Tooltip.Content>
                      ) : null
                    }
                  </Tooltip.Root>
                </ToggleGroup.Root>
              );
            }}
          </form.Field>
          <form.Field name="isCurated">
            {(field) => (
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <Toggle
                      variant="outline"
                      pressed={field.value}
                      aria-label={field.value ? 'Curated' : 'Not curated'}
                      onPressedChange={(pressed) => {
                        field.handleChange(pressed);
                        debouncedSave();
                      }}
                      disabled={isFormLoading}
                    >
                      {field.value ? <BadgeCheckIcon /> : <BadgeIcon />}
                    </Toggle>
                  }
                />
                <Tooltip.Content>{field.value ? 'Curated' : 'Not curated'}</Tooltip.Content>
              </Tooltip.Root>
            )}
          </form.Field>
          <form.Field name="isPrivate">
            {(field) => (
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <Toggle
                      variant="outline"
                      pressed={field.value}
                      aria-label={field.value ? 'Private' : 'Public'}
                      onPressedChange={(pressed) => {
                        field.handleChange(pressed);
                        debouncedSave();
                      }}
                      disabled={isFormLoading}
                    >
                      {field.value ? <EyeOffIcon /> : <EyeIcon />}
                    </Toggle>
                  }
                />
                <Tooltip.Content>{field.value ? 'Private' : 'Public'}</Tooltip.Content>
              </Tooltip.Root>
            )}
          </form.Field>
        </styled.div>

        <styled.div css={{ borderRadius: 'md', border: 'divider' }}>
          <Table.Root>
            <Table.Table>
              <Table.Body css={{ '& td:first-child': { width: '20' } }}>
                <Table.Row>
                  <Table.Cell>
                    <Label css={{ display: 'flex', width: 'full' }} htmlFor="url">
                      URL
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field
                      name="url"
                      validators={[
                        {
                          run: z.url().or(z.string().length(0)).nullable(),
                          triggers: [
                            'blur',
                            {
                              trigger: 'change',
                              when: ({ fieldApi }) => fieldApi.meta.isBlurred,
                            },
                          ],
                        },
                      ]}
                    >
                      {(field) => (
                        <>
                          <styled.div
                            css={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2',
                            }}
                          >
                            <GhostInput
                              id="url"
                              css={{ width: 'full', color: 'display' }}
                              value={field.value ?? ''}
                              placeholder="https://example.com"
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                debouncedSave();
                              }}
                              onBlur={() => {
                                field.handleBlur();
                                void commit();
                              }}
                              readOnly={isFormLoading}
                            />
                            {field.value && <ExternalLink href={field.value}>{null}</ExternalLink>}
                          </styled.div>
                          {field.meta.isInvalid && (
                            <styled.p
                              css={{
                                palette: 'error',
                                chromatic: true,
                                textStyle: 'sm',
                              }}
                            >
                              {field.errors.map((error) => error.message).join(', ')}
                            </styled.p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>
                    <Label css={{ display: 'flex', width: 'full' }} htmlFor="abbreviation">
                      Abbreviation
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field name="abbreviation">
                      {(field) => (
                        <GhostInput
                          id="abbreviation"
                          css={{ width: 'full', color: 'display' }}
                          value={field.value ?? ''}
                          placeholder="Short form"
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            debouncedSave();
                          }}
                          onBlur={() => void commit()}
                          readOnly={isFormLoading}
                        />
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>
                    <Label css={{ display: 'flex', width: 'full' }} htmlFor="sense">
                      Sense
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field name="sense">
                      {(field) => (
                        <GhostInput
                          id="sense"
                          css={{ width: 'full', color: 'display' }}
                          value={field.value ?? ''}
                          placeholder="Meaning or definition"
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            debouncedSave();
                          }}
                          onBlur={() => void commit()}
                          readOnly={isFormLoading}
                        />
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Table>
          </Table.Root>
        </styled.div>
      </styled.div>

      <styled.div
        css={{
          marginBlockStart: '4',
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
        }}
      >
        <form.Field name="summary">
          {(field) => (
            <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
              <Label htmlFor="summary">Summary</Label>
              <DynamicTextarea
                id="summary"
                value={field.value ?? ''}
                placeholder="A brief summary of this record"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => void commit()}
                disabled={isFormLoading}
              />
            </styled.div>
          )}
        </form.Field>

        <form.Field name="content">
          {(field) => (
            <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
              <Label htmlFor="content">Content</Label>
              <DynamicTextarea
                id="content"
                value={field.value ?? ''}
                placeholder="Main content"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => void commit()}
                disabled={isFormLoading}
              />
            </styled.div>
          )}
        </form.Field>

        {record && record.media.length > 0 ? (
          <styled.div
            css={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'clip',
              borderRadius: 'md',
              borderWidth: '1px',
              borderColor: 'divider/75',
            }}
          >
            <MediaGrid
              media={record.media}
              onDelete={(media) => deleteMediaMutation.mutate([media.id])}
              className={css({ borderRadius: 'none' })}
            />

            <form.Field name="mediaCaption">
              {(captionField) => (
                <styled.div
                  css={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderBlockStartWidth: '1px',
                    borderBlockStartColor: 'divider/75',
                  }}
                >
                  <Label htmlFor="mediaCaption" className={css({ srOnly: true })}>
                    Caption
                  </Label>
                  <DynamicTextarea
                    ref={mediaCaptionRef}
                    id="mediaCaption"
                    value={captionField.value ?? ''}
                    placeholder="Add a caption..."
                    onChange={(e) => {
                      captionField.handleChange(e.target.value);
                      debouncedSave();
                    }}
                    onBlur={() => void commit()}
                    disabled={isFormLoading}
                    css={{
                      border: 'none',
                      boxShadow: 'none',
                      _focusVisible: {
                        outlineWidth: '0',
                      },
                    }}
                  />
                </styled.div>
              )}
            </form.Field>
          </styled.div>
        ) : (
          <MediaUpload ref={mediaUploadRef} onUpload={uploadFile} />
        )}

        <form.Field name="notes">
          {(field) => (
            <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
              <Label htmlFor="notes" className={css({ srOnly: true })}>
                Notes
              </Label>
              <DynamicTextarea
                id="notes"
                value={field.value ?? ''}
                placeholder="Add notes..."
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => void commit()}
                disabled={isFormLoading}
                css={{
                  margin: '0',
                  padding: '0',
                  border: 'none',
                  color: 'secondary',
                  boxShadow: 'none',
                  _placeholder: {
                    fontStyle: 'italic',
                  },
                  _focusVisible: {
                    outlineWidth: '0',
                  },
                }}
              />
            </styled.div>
          )}
        </form.Field>
      </styled.div>
      <Metabar
        recordId={recordId}
        className={css({
          order: '[calc(-infinity)]',
          marginBlockStart: '-1',
          marginBlockEnd: '3',
          borderBlockEndWidth: '1px',
          borderBlockEndColor: 'divider',
          paddingBlockEnd: '1',
        })}
        onDelete={onDelete}
      />
    </styled.form>
  );
}
