import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { RectangleEllipsisIcon, ShoppingBasketIcon } from 'lucide-react';
import { memo } from 'react';
import { Avatar } from '@/components/avatar';
import { Markdown } from '@/components/markdown';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
import { getRecordTitle, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

interface RecordDisplayProps {
  recordId: DbId;
  compact?: boolean;
  className?: string;
}

export const RecordDisplay = memo(function RecordDisplay({
  recordId,
  compact,
  className,
}: RecordDisplayProps) {
  const { data: record, isError } = useRecord(recordId);
  const inBasket = useInBasket(recordId);
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
    abbreviation,
    sense,
    avatarUrl,
    title,
    summary,
    content,
    notes,
    mediaCaption,
    sources,
    media,
  } = record;

  const { creatorTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  const TypeIcon = recordTypeIcons[type].icon;
  const recordMedia = media ?? [];

  return (
    <article
      className={cn('group flex cursor-pointer flex-col gap-[0.5lh] text-sm', className)}
      data-slot="record-display"
      onClick={() => {
        void navigate({ to: '/records/$recordId', params: { recordId: id } });
      }}
    >
      <header className="flex flex-wrap items-center gap-2" data-slot="record-display-header">
        <TypeIcon className="size-[1lh] shrink-0 text-c-hint" />

        <div className="flex flex-1 flex-wrap items-baseline gap-2 text-pretty">
          <Link
            to="/records/$recordId"
            params={{ recordId: id }}
            onClick={(e) => e.stopPropagation()}
            data-has-title={Boolean(title ?? creatorTitle)}
            className="font-semibold text-c-primary no-underline transition-colors duration-100 ease-in-out group-hover:text-c-accent hover:no-underline data-[has-title=false]:font-medium data-[has-title=false]:text-c-hint"
          >
            {getRecordTitle(record)}
          </Link>
          {abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
          {sense && <em className="text-xs text-c-hint italic">{sense}</em>}
        </div>
        {inBasket && <ShoppingBasketIcon className="text-c-accent" />}
        <SourceLogos sources={sources} className="text-[0.875em] opacity-50" />
        {avatarUrl && <Avatar src={avatarUrl} fallback={title?.charAt(0) ?? type.charAt(0)} />}
      </header>

      {recordMedia.length > 0 && (
        <figure className="flex flex-col gap-1.5">
          <MediaGrid media={recordMedia} />
          {mediaCaption && (
            <Markdown as="figcaption" className="text-xs text-c-secondary">
              {mediaCaption}
            </Markdown>
          )}
        </figure>
      )}

      {summary && (
        <Markdown className={cn('text-c-display', compact && 'line-clamp-3')}>{summary}</Markdown>
      )}

      {content && (
        <Markdown className={cn('text-c-primary', compact && 'line-clamp-6')}>{content}</Markdown>
      )}

      {notes && (
        <Markdown className={cn('font-mono text-xs text-c-secondary', compact && 'line-clamp-3')}>
          {notes}
        </Markdown>
      )}
    </article>
  );
});
