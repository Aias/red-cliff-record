import { CornerDownRightIcon } from 'lucide-react';
import { memo } from 'react';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { toTitleCase } from '@/shared/lib/formatting';
import type { DbId } from '@/shared/types/api';
import { recordTypeIcons } from './type-icons';

export const SearchResultItem = memo(function SearchResultItem({ id }: { id: DbId }) {
  const { data: record } = useRecord(id);

  if (!record) {
    return (
      <div className="flex w-full grow items-center gap-2">
        <div className="size-[1lh] shrink-0 rounded bg-c-mist" />
        <div className="h-[1lh] flex-1 rounded bg-c-mist" />
      </div>
    );
  }

  const {
    type,
    title,
    abbreviation,
    sense,
    content,
    summary,
    url,
    outgoingLinks,
    media,
    avatarUrl,
    mediaCaption,
    sources,
  } = record;

  const { creatorTitle, parentTitle } = getRecordTitleFallbacks(outgoingLinks);
  const preview = summary ?? content ?? url;

  const labelElement = (
    <>
      <strong className="text-c-accent">
        {title ??
          creatorTitle ??
          (parentTitle ? (
            <>
              <CornerDownRightIcon
                className="relative -top-0.25 mr-0.75 text-c-hint"
                aria-label="Child of"
              />
              {parentTitle}
            </>
          ) : (
            `Untitled ${toTitleCase(type)}`
          ))}
      </strong>
      {abbreviation && <span className="ml-1 text-c-hint">({abbreviation})</span>}
    </>
  );

  const recordMedia = media ?? [];
  const firstMedia = recordMedia[0];
  const mediaItem =
    firstMedia ?? (avatarUrl ? { type: 'image' as const, url: avatarUrl, altText: null } : null);

  const TypeIcon = recordTypeIcons[type].icon;
  const thumbnailVideoLabel = mediaItem?.altText?.trim() || mediaCaption?.trim() || undefined;

  return (
    <div className="flex w-full grow items-center gap-2">
      <TypeIcon className="size-[1lh] text-c-hint" />
      <div className="line-clamp-1 flex grow items-center gap-1 truncate overflow-ellipsis whitespace-nowrap">
        <div className="min-w-0 shrink-0">{labelElement}</div>
        {sense && <span className="shrink-0 truncate text-c-hint italic">{sense}</span>}
        <div className="ml-2 line-clamp-1 shrink truncate text-c-secondary">{preview}</div>
      </div>
      {mediaItem && (
        <div className="relative aspect-3/2 h-lh shrink-0 self-center overflow-hidden rounded-md border border-c-divider bg-c-mist">
          {mediaItem.type === 'image' ? (
            <img
              src={mediaItem.url}
              alt={mediaItem.altText ?? mediaCaption ?? ''}
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <LazyVideo
              src={mediaItem.url}
              aria-label={thumbnailVideoLabel}
              className="absolute inset-0 object-cover"
              playsInline
            />
          )}
        </div>
      )}
      {sources ? (
        <ul className="flex items-center gap-1.5 text-[0.75em] opacity-50">
          {sources.map((s) => (
            <li key={s}>
              <IntegrationLogo integration={s} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
