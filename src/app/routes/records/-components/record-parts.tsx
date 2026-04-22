import type { IntegrationType } from '@hozo/schema/operations';
import { CornerDownRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { getRecordTitleFallbacks } from '@/lib/hooks/record-queries';
import type { RecordGet } from '@/shared/types/domain';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';

/* ─── SourceLogos ─────────────────────────────────────────────── */

interface SourceLogosProps {
  sources: IntegrationType[] | null | undefined;
  className?: string;
}

export const SourceLogos = memo(function SourceLogos({ sources, className }: SourceLogosProps) {
  if (!sources?.length) return null;
  return (
    <styled.ul className={className} css={{ display: 'flex', alignItems: 'center', gap: '1.5' }}>
      {sources.map((s) => (
        <li key={s}>
          <IntegrationLogo integration={s} />
        </li>
      ))}
    </styled.ul>
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

const mediaFillCss = css({
  position: 'absolute',
  inset: '0',
  boxSize: 'full',
  objectFit: 'cover',
});

export const RecordThumbnail = memo(function RecordThumbnail({
  media,
  size = 'sm',
  videoLabel,
  autoPlay,
  className,
}: RecordThumbnailProps) {
  return (
    <styled.div
      data-size={size}
      className={className}
      css={{
        position: 'relative',
        aspectRatio: '3/2',
        flexShrink: '0',
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 'md',
        border: 'divider',
        backgroundColor: 'mist',
        height: 'lh',
        '&[data-size="md"]': { height: '[2lh]' },
      }}
    >
      {media.type === 'image' ? (
        <img
          src={media.url}
          alt={media.altText ?? ''}
          className={mediaFillCss}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <LazyVideo
          src={media.url}
          aria-label={videoLabel}
          className={mediaFillCss}
          autoPlay={autoPlay}
          playsInline
          muted={autoPlay}
          loop={autoPlay}
        />
      )}
    </styled.div>
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
          className={css({
            position: 'relative',
            insetBlockStart: '-0.25',
            marginInlineEnd: '0.75',
            color: 'muted',
          })}
          aria-label="Child of"
        />
        {parentTitle}
      </>
    ) : (
      fallback
    ))
  );
}
