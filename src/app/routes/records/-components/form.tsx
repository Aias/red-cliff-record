import { RecordTypeSchema, type RecordType } from '@hozo/schema/records.shared';
import { useForm } from '@tanstack/react-form';
import { useRouterState } from '@tanstack/react-router';
import { BadgeCheckIcon, BadgeIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { DynamicTextarea } from '@/components/dynamic-textarea';
import { ExternalLink } from '@/components/external-link';
import { GhostInput } from '@/components/ghost-input';
import { Label } from '@/components/label';
import MediaGrid from '@/components/media-grid';
import { MediaUpload } from '@/components/media-upload';
import { Spinner } from '@/components/spinner';
import { Table } from '@/components/table';
import { Toggle } from '@/components/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip';
import { useDeleteMedia } from '@/lib/hooks/media-mutations';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useRecord } from '@/lib/hooks/record-queries';
import { addToBasket, removeFromBasket, useInBasket } from '@/lib/hooks/use-basket';
import { useRecordUpload } from '@/lib/hooks/use-record-upload';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { validateRecord } from '@/lib/server/validate-record';
import { cn } from '@/lib/utils';
import type { RecordGet } from '@/shared/types/domain';
import { Metabar } from './record-metabar';
import { recordTypeIcons } from './type-icons';

interface RecordFormProps extends React.HTMLAttributes<HTMLFormElement> {
  recordId: number;
  onFinalize: () => void;
  onDelete?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}

const defaultData: RecordGet = {
  id: 0,
  slug: null,
  type: 'artifact',
  title: null,
  sense: null,
  abbreviation: null,
  url: null,
  avatarUrl: null,
  summary: null,
  content: null,
  notes: null,
  mediaCaption: null,
  isCurated: false,
  isPrivate: false,
  rating: 0,
  eloScore: 1200,
  reminderAt: null,
  sources: [],
  media: [],
  recordCreatedAt: new Date(),
  recordUpdatedAt: new Date(),
  contentCreatedAt: new Date(),
  contentUpdatedAt: new Date(),
} as const;

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

  const formData = record ?? defaultData;
  const isFormLoading = isLoading || !record;

  const inBasket = useInBasket(recordId);
  const updateMutation = useUpsertRecord();
  const deleteMediaMutation = useDeleteMedia();
  const { uploadFile, isUploading } = useRecordUpload(recordId);

  const form = useForm({
    defaultValues: formData,
    onSubmit: async ({ value }) => {
      const {
        type,
        isCurated,
        isPrivate,
        title,
        url,
        abbreviation,
        sense,
        summary,
        content,
        notes,
        mediaCaption,
      } = value;
      await updateMutation.mutateAsync({
        id: recordId,
        type,
        isCurated,
        isPrivate,
        title: title || null,
        url: url || null,
        abbreviation: abbreviation || null,
        sense: sense || null,
        summary: summary || null,
        content: content || null,
        notes: notes || null,
        mediaCaption: mediaCaption || null,
      });
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result = await validateRecord({ data: value });
        if (!result.success) {
          return {
            form: result.formError,
            fields: result.fieldErrors,
          };
        }
        return undefined;
      },
    },
  });

  useEffect(() => {
    if (record) {
      form.setFieldValue('media', record.media ?? [], {
        dontUpdateMeta: true,
      });
    }
  }, [record, form]);

  // Auto-save functionality
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      // Only save if values have actually changed
      if (!form.state.isDefaultValue) {
        void form.handleSubmit();
      }
    }, 1000); // Save after 1 second of inactivity
  }, [form]);

  const immediateSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await form.handleSubmit();
  }, [form]);

  // Save immediately before navigation or form blur
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only save if there's a pending save and values have actually changed
      if (saveTimeoutRef.current && !form.state.isDefaultValue) {
        // Note: beforeunload can't wait for async operations, so we trigger it but can't guarantee completion
        void immediateSave();
      }
    };

    // Save when navigating away or closing
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [form.state.isDefaultValue, immediateSave]);

  const curateAndNextHandler = useCallback(async () => {
    // Set curated flag before saving to avoid race condition with bulkUpsert
    form.setFieldValue('isCurated', true);
    // Save immediately before navigation and wait for completion
    await immediateSave();
    // Navigate after save completes
    onFinalize();
  }, [form, immediateSave, onFinalize]);

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
    <form
      ref={formRef}
      key={recordId}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      onBlur={(e) => {
        // If focus is leaving the form entirely and values changed, save immediately
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !form.state.isDefaultValue) {
          void immediateSave();
        }
      }}
      onKeyDown={(e) => {
        // Escape blurs the currently focused element (first escape unfocuses field)
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
      }}
      onPaste={handlePaste}
      className={cn('relative flex flex-col', className)}
      {...props}
    >
      {isFormLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-c-container/50 backdrop-blur-sm">
          <Spinner />
        </div>
      )}
      <div className="flex flex-col gap-4">
        <h1 className="flex items-center gap-3">
          <form.Field name="title">
            {(field) => (
              <div className="grow">
                <GhostInput
                  ref={titleInputRef}
                  value={field.state.value ?? ''}
                  placeholder="Untitled Record"
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    debouncedSave();
                  }}
                  onBlur={() => debouncedSave()}
                  readOnly={isFormLoading}
                  className="text-c-display placeholder:font-medium"
                />
                {field.state.meta.errors && (
                  <p
                    data-chroma="chromatic" // TODO: CLR-DESTRUCTIVE
                    data-palette="tomato"
                    className="text-sm"
                  >
                    {field.state.meta.errors.map(getErrorMessage).join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </h1>

        <div className="@container flex items-center gap-2">
          <form.Field name="type">
            {(field) => (
              <ToggleGroup
                type="single"
                value={field.state.value}
                onValueChange={(value) => {
                  if (value) {
                    field.handleChange(value as RecordType);
                    debouncedSave();
                  }
                }}
                variant="outline"
                className="grow"
                disabled={isFormLoading}
              >
                {RecordTypeSchema.options.map((type) => {
                  const { icon: Icon, description } = recordTypeIcons[type];
                  return (
                    <Tooltip key={type}>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value={type}
                          aria-label={type}
                          data-state={field.state.value === type ? 'on' : 'off'}
                          className="flex grow items-center gap-1"
                        >
                          <Icon />
                          <span className="hidden capitalize @[480px]:inline">{type}</span>
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>
                          <strong className="mr-1 capitalize">{type}</strong>
                          {description}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </ToggleGroup>
            )}
          </form.Field>
          <form.Field name="isCurated">
            {(field) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Toggle
                      variant="outline"
                      pressed={field.state.value}
                      aria-label={field.state.value ? 'Curated' : 'Not curated'}
                      onPressedChange={(pressed) => {
                        field.handleChange(pressed);
                        debouncedSave();
                      }}
                      disabled={isFormLoading}
                    >
                      {field.state.value ? <BadgeCheckIcon /> : <BadgeIcon />}
                    </Toggle>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{field.state.value ? 'Curated' : 'Not curated'}</TooltipContent>
              </Tooltip>
            )}
          </form.Field>
          <form.Field name="isPrivate">
            {(field) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Toggle
                      variant="outline"
                      pressed={field.state.value}
                      aria-label={field.state.value ? 'Private' : 'Public'}
                      onPressedChange={(pressed) => {
                        field.handleChange(pressed);
                        debouncedSave();
                      }}
                      disabled={isFormLoading}
                    >
                      {field.state.value ? <EyeOffIcon /> : <EyeIcon />}
                    </Toggle>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{field.state.value ? 'Private' : 'Public'}</TooltipContent>
              </Tooltip>
            )}
          </form.Field>
        </div>

        <div className="rounded-md border border-c-divider">
          <Table.Root>
            <Table.Table>
              <Table.Body css={{ '& td:first-child': { width: '20' } }}>
                <Table.Row>
                  <Table.Cell>
                    <Label className="flex w-full" htmlFor="url">
                      URL
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field
                      name="url"
                      validators={{
                        onChange: z.url().or(z.string().length(0)).nullable(),
                      }}
                    >
                      {(field) => (
                        <>
                          <div className="flex items-center gap-2">
                            <GhostInput
                              id="url"
                              className="w-full text-c-display"
                              value={field.state.value ?? ''}
                              placeholder="https://example.com"
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                debouncedSave();
                              }}
                              onBlur={() => debouncedSave()}
                              readOnly={isFormLoading}
                            />
                            {field.state.value && (
                              <ExternalLink href={field.state.value}>{null}</ExternalLink>
                            )}
                          </div>
                          {field.state.meta.errors && (
                            <p
                              data-chroma="chromatic" // TODO: CLR-DESTRUCTIVE
                              data-palette="tomato"
                              className="text-sm"
                            >
                              {field.state.meta.errors.map(getErrorMessage).join(', ')}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>
                    <Label className="flex w-full" htmlFor="abbreviation">
                      Abbreviation
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field name="abbreviation">
                      {(field) => (
                        <GhostInput
                          id="abbreviation"
                          className="w-full text-c-display"
                          value={field.state.value ?? ''}
                          placeholder="Short form"
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            debouncedSave();
                          }}
                          onBlur={() => debouncedSave()}
                          readOnly={isFormLoading}
                        />
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>
                    <Label className="flex w-full" htmlFor="sense">
                      Sense
                    </Label>
                  </Table.Cell>
                  <Table.Cell>
                    <form.Field name="sense">
                      {(field) => (
                        <GhostInput
                          id="sense"
                          className="w-full text-c-display"
                          value={field.state.value ?? ''}
                          placeholder="Meaning or definition"
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            debouncedSave();
                          }}
                          onBlur={() => debouncedSave()}
                          readOnly={isFormLoading}
                        />
                      )}
                    </form.Field>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Table>
          </Table.Root>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <form.Field name="summary">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="summary">Summary</Label>
              <DynamicTextarea
                id="summary"
                value={field.state.value ?? ''}
                placeholder="A brief summary of this record"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => debouncedSave()}
                disabled={isFormLoading}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="content">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content">Content</Label>
              <DynamicTextarea
                id="content"
                value={field.state.value ?? ''}
                placeholder="Main content"
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => debouncedSave()}
                disabled={isFormLoading}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="media">
          {(field) =>
            field.state.value && field.state.value.length > 0 ? (
              <div className="flex flex-col overflow-clip rounded-md border border-c-divider/75">
                <MediaGrid
                  media={field.state.value}
                  onDelete={(media) => deleteMediaMutation.mutate([media.id])}
                  className="rounded-none"
                />

                <form.Field name="mediaCaption">
                  {(captionField) => (
                    <div className="flex flex-col border-t border-c-divider/75">
                      <Label htmlFor="mediaCaption" className="sr-only">
                        Caption
                      </Label>
                      <DynamicTextarea
                        ref={mediaCaptionRef}
                        id="mediaCaption"
                        value={captionField.state.value ?? ''}
                        placeholder="Add a caption..."
                        onChange={(e) => {
                          captionField.handleChange(e.target.value);
                          debouncedSave();
                        }}
                        onBlur={() => debouncedSave()}
                        disabled={isFormLoading}
                        css={{
                          border: 'none',
                          boxShadow: 'none',
                          _focusVisible: {
                            outlineWidth: '0',
                          },
                        }}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            ) : (
              <MediaUpload ref={mediaUploadRef} onUpload={uploadFile} />
            )
          }
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes" className="sr-only">
                Notes
              </Label>
              <DynamicTextarea
                id="notes"
                value={field.state.value ?? ''}
                placeholder="Add notes..."
                onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedSave();
                }}
                onBlur={() => debouncedSave()}
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
            </div>
          )}
        </form.Field>
      </div>
      <Metabar
        recordId={recordId}
        className="order-first -mt-1 mb-3 border-b border-c-divider pb-1"
        onDelete={onDelete}
      />
    </form>
  );
}
