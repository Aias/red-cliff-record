import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import { memo } from 'react';
import { Avatar } from '@/components/avatar';
import { IntegrationLogo } from '@/components/integration-logo';
import { Markdown } from '@/components/markdown';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';
import { recordTypeIcons } from './type-icons';

interface RecordDisplayProps {
  recordId: DbId;
  className?: string;
}

/**
 * Compact read-only display of a record.
 * Shows all record data in a typographically clean format.
 * Clicking the title navigates to edit that record.
 */
export const RecordDisplay = memo(({ recordId, className }: RecordDisplayProps) => {
  const { data: record, isLoading, isError } = useRecord(recordId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-6', className)}>
        <Spinner />
      </div>
    );
  }

  if (isError || !record) {
    return (
      <div className={cn('flex items-center gap-2 py-4 text-c-hint italic', className)}>
        <RectangleEllipsisIcon className="size-4" />
        <span>Record not found (ID: {recordId})</span>
      </div>
    );
  }

  const {
    id,
    type,
    title,
    abbreviation,
    sense,
    avatarUrl,
    summary,
    content,
    notes,
    mediaCaption,
    sources,
    media,
  } = record;

  const TypeIcon = recordTypeIcons[type].icon;
  const recordMedia = media ?? [];
  const recordSources = sources ?? [];
  const hasMedia = recordMedia.length > 0;

  return (
    <article
      className={cn('flex flex-col gap-3 text-sm', className)}
      data-slot="record-display"
      onClick={() => {
        void navigate({
          to: '/records/$recordId',
          params: { recordId: id },
        });
      }}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3" data-slot="record-display-header">
        {avatarUrl && (
          <Avatar
            src={avatarUrl}
            fallback={title?.charAt(0) ?? type.charAt(0)}
            className="size-6"
          />
        )}
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link
              to="/records/$recordId"
              params={{ recordId: id }}
              data-has-title={Boolean(title)}
              className="text-base font-semibold text-c-primary underline-offset-4 hover:underline data-[has-title=false]:font-medium data-[has-title=false]:text-c-hint"
            >
              {title ?? 'Untitled'}
            </Link>
            {abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
          </div>
          {sense && <em className="ml-6 text-xs text-c-secondary">{sense}</em>}
        </div>

        <TypeIcon className="size-4 shrink-0 text-c-hint" />
        {recordSources.length > 0 && (
          <ul className="flex items-center gap-2 text-xs text-c-secondary">
            {recordSources.map((source) => (
              <li key={source}>
                <IntegrationLogo integration={source} />
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Media */}
      {hasMedia && (
        <figure className="flex flex-col gap-1">
          <MediaGrid media={recordMedia} />
          {mediaCaption && (
            <Markdown as="figcaption" className="text-xs text-c-secondary">
              {mediaCaption}
            </Markdown>
          )}
        </figure>
      )}

      {/* Media caption without media */}
      {mediaCaption && !hasMedia && (
        <section className="flex flex-col gap-1" data-slot="record-display-media-caption">
          <h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">
            Media caption
          </h4>
          <Markdown className="text-sm text-c-primary">{mediaCaption}</Markdown>
        </section>
      )}

      {/* Summary */}
      {summary && <Markdown className="text-sm font-medium text-c-primary">{summary}</Markdown>}

      {/* Content */}
      {content && <Markdown className="text-sm text-c-primary">{content}</Markdown>}

      {/* Notes */}
      {notes && <Markdown className="font-mono text-xs text-c-secondary">{notes}</Markdown>}
    </article>
  );
});

RecordDisplay.displayName = 'RecordDisplay';
