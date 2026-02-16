import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import { memo } from 'react';
import { Avatar } from '@/components/avatar';
import { IntegrationLogo } from '@/components/integration-logo';
import { Markdown } from '@/components/markdown';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
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
  const { data: record, isError } = useRecord(recordId);
  const navigate = useNavigate();

  if (!record) {
    return isError ? (
      <div className={cn('flex items-center gap-2 py-4 text-c-hint italic', className)}>
        <RectangleEllipsisIcon className="size-4" />
        <span>Record not found (ID: {recordId})</span>
      </div>
    ) : (
      <div className={cn('flex items-center justify-center py-6', className)}>
        <Spinner />
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

  const { creatorTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  const displayTitle = title ?? creatorTitle;
  const TypeIcon = recordTypeIcons[type].icon;
  const recordMedia = media ?? [];
  const recordSources = sources ?? [];
  const hasMedia = recordMedia.length > 0;

  return (
    <article
      className={cn('flex flex-col gap-[0.5lh] text-sm', className)}
      data-slot="record-display"
      onClick={() => {
        void navigate({
          to: '/records/$recordId',
          params: { recordId: id },
        });
      }}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2" data-slot="record-display-header">
        <TypeIcon className="size-[1lh] shrink-0 text-c-hint" />

        <div className="flex flex-1 flex-wrap items-baseline gap-2 text-pretty">
          <Link
            to="/records/$recordId"
            params={{ recordId: id }}
            data-has-title={Boolean(displayTitle)}
            className="font-semibold text-c-primary underline-offset-4 hover:underline data-[has-title=false]:font-medium data-[has-title=false]:text-c-hint"
          >
            {displayTitle ?? 'Untitled'}
          </Link>
          {abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
          {sense && <em className="text-xs text-c-secondary">{sense}</em>}
        </div>
        {recordSources.length > 0 && (
          <ul className="flex items-center gap-1.5 text-[0.875em] opacity-50">
            {recordSources.map((source) => (
              <li key={source}>
                <IntegrationLogo integration={source} />
              </li>
            ))}
          </ul>
        )}
        {avatarUrl && <Avatar src={avatarUrl} fallback={title?.charAt(0) ?? type.charAt(0)} />}
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

      {/* Summary */}
      {summary && <Markdown className="line-clamp-2 text-c-display">{summary}</Markdown>}

      {/* Content */}
      {content && <Markdown className="line-clamp-4 text-c-primary">{content}</Markdown>}

      {/* Notes */}
      {notes && (
        <Markdown className="line-clamp-2 font-mono text-xs text-c-secondary">{notes}</Markdown>
      )}
    </article>
  );
});

RecordDisplay.displayName = 'RecordDisplay';
