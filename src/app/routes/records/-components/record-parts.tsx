import type { IntegrationType } from '@hozo/schema/operations';
import { CornerDownRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { getRecordTitleFallbacks } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { RecordGet } from '@/shared/types/domain';

/* ─── SourceLogos ─────────────────────────────────────────────── */

interface SourceLogosProps {
  sources: IntegrationType[] | null | undefined;
  className?: string;
}

export const SourceLogos = memo(function SourceLogos({ sources, className }: SourceLogosProps) {
  if (!sources?.length) return null;
  return (
    <ul className={cn('flex items-center gap-1.5', className)}>
      {sources.map((s) => (
        <li key={s}>
          <IntegrationLogo integration={s} />
        </li>
      ))}
    </ul>
  );
});

/* ─── RecordThumbnail ─────────────────────────────────────────── */

interface RecordThumbnailProps {
  media: { type: string; url: string; altText?: string | null };
  size?: 'sm' | 'md';
  videoLabel?: string;
  autoPlay?: boolean;
  className?: string;
}

export const RecordThumbnail = memo(function RecordThumbnail({
  media,
  size = 'sm',
  videoLabel,
  autoPlay,
  className,
}: RecordThumbnailProps) {
  return (
    <div
      className={cn(
        'relative aspect-3/2 shrink-0 self-center overflow-hidden rounded-md border border-c-divider bg-c-mist',
        size === 'sm' ? 'h-lh' : 'h-[2lh]',
        className
      )}
    >
      {media.type === 'image' ? (
        <img
          src={media.url}
          alt={media.altText ?? ''}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <LazyVideo
          src={media.url}
          aria-label={videoLabel}
          className="absolute inset-0 size-full object-cover"
          autoPlay={autoPlay}
          playsInline
          muted={autoPlay}
          loop={autoPlay}
        />
      )}
    </div>
  );
});

/* ─── getRecordTitle ──────────────────────────────────────────── */

/** Resolve a record's display title through the fallback chain: title → creator → ↳parent → fallback */
export function getRecordTitle(
  record: Pick<RecordGet, 'title' | 'outgoingLinks'>,
  fallback = 'Untitled'
): ReactNode {
  const { creatorTitle, parentTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  return (
    record.title ??
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
      fallback
    ))
  );
}
