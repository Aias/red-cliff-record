import type { MediaSelect } from '@hozo/schema/media';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { Button } from './button';
import { LazyVideo } from './lazy-video';
import { MediaLightbox } from './media-lightbox';

interface MediaGridProps {
  media: MediaSelect[];
  className?: string;
  onDelete?: (media: MediaSelect) => void;
}

const mediaFillCss = css({
  boxSize: 'full',
  objectFit: 'cover',
});

const overlayRevealCss = css.raw({
  opacity: 0,
  transitionProperty: '[opacity]',
  transitionDuration: '200',
  transitionTimingFunction: 'easeOut.cubic',
  _groupHover: { opacity: 1 },
  _groupFocusWithin: { opacity: 1 },
});

function MediaGrid({ media, className, onDelete }: MediaGridProps) {
  // Limit to 8 media items maximum
  const displayMedia = media.slice(0, 8);
  const count = displayMedia.length;
  const images = displayMedia.filter((item) => item.type === 'image');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imageIndexById = images.reduce<Map<number, number>>((map, item, index) => {
    map.set(item.id, index);
    return map;
  }, new Map());

  if (count === 0) return null;

  return (
    <styled.div
      className={className}
      css={{
        position: 'relative',
        display: 'grid',
        aspectRatio: '3/2',
        width: 'full',
        gap: 'px',
        overflow: 'hidden',
        borderRadius: 'md',
        backgroundColor: 'container',
      }}
      style={{
        gridTemplateColumns: getGridColumns(count),
        gridTemplateRows: getGridRows(count),
      }}
    >
      {displayMedia.map((item, index) => {
        const imageIndex = imageIndexById.get(item.id);
        const isImage = typeof imageIndex === 'number';

        const openLightbox = () => {
          if (!isImage) return;
          setLightboxIndex(imageIndex);
        };

        return (
          <styled.div
            key={item.id}
            className="group"
            css={{
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
              _focusVisible: {
                outlineWidth: '2px',
                outlineColor: 'focus',
                outlineStyle: 'solid',
              },
            }}
            style={{ gridArea: getGridArea(count, index) }}
            role={isImage ? 'button' : undefined}
            tabIndex={isImage ? 0 : -1}
            aria-label={isImage ? 'View full size' : undefined}
            aria-haspopup={isImage ? 'dialog' : undefined}
            onClick={isImage ? openLightbox : undefined}
            onKeyDown={(event) => {
              if (!isImage) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openLightbox();
              }
            }}
          >
            <styled.div
              css={css.raw(overlayRevealCss, {
                pointerEvents: 'none',
                position: 'absolute',
                inset: '0',
                zIndex: '10',
                backgroundImage: '[linear-gradient(to bottom, oklch(0 0 0 / 0.5), transparent)]',
              })}
            />

            {item.type === 'video' ? (
              <LazyVideo
                src={item.url}
                aria-label={item.altText || `Media ${index + 1}`}
                className={mediaFillCss}
                controls
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <styled.img
                src={item.url}
                alt={item.altText || `Media ${index + 1}`}
                className={mediaFillCss}
                loading="lazy"
                decoding="async"
              />
            )}

            {onDelete && (
              <styled.div
                css={css.raw(overlayRevealCss, {
                  position: 'absolute',
                  insetBlockStart: '2',
                  insetInlineEnd: '2',
                  zIndex: '20',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '1.5',
                  borderRadius: 'md',
                  backgroundColor: 'background',
                })}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete media"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item);
                  }}
                >
                  <Trash2Icon />
                </Button>
              </styled.div>
            )}
          </styled.div>
        );
      })}
      <MediaLightbox
        images={images}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(nextIndex) => setLightboxIndex(nextIndex)}
      />
    </styled.div>
  );
}

// Helper functions to determine grid layout
function getGridColumns(count: number): string {
  switch (count) {
    case 1:
      return '1fr';
    case 2:
      return '1fr 1fr';
    case 3:
      return '1fr 1fr';
    default:
      return '1fr 1fr';
  }
}

function getGridRows(count: number): string {
  switch (count) {
    case 1:
      return '1fr';
    case 2:
      return '1fr';
    case 3:
      return '1fr 1fr';
    default:
      return '1fr 1fr';
  }
}

function getGridArea(count: number, index: number): string {
  // Single image
  if (count === 1) return '1 / 1 / 2 / 2';

  // Two images - divide vertically
  if (count === 2) {
    return index === 0 ? '1 / 1 / 2 / 2' : '1 / 2 / 2 / 3';
  }

  // Three images - left column and right column divided horizontally
  if (count === 3) {
    if (index === 0) return '1 / 1 / 3 / 2'; // Left full height
    if (index === 1) return '1 / 2 / 2 / 3'; // Top right
    return '2 / 2 / 3 / 3'; // Bottom right
  }

  // Four images - divide in quarters
  if (count === 4) {
    if (index === 0) return '1 / 1 / 2 / 2'; // Top left
    if (index === 1) return '1 / 2 / 2 / 3'; // Top right
    if (index === 2) return '2 / 1 / 3 / 2'; // Bottom left
    return '2 / 2 / 3 / 3'; // Bottom right
  }

  // Five images - quarters plus bottom right divided
  if (count === 5) {
    if (index === 0) return '1 / 1 / 2 / 2'; // Top left
    if (index === 1) return '1 / 2 / 2 / 3'; // Top right
    if (index === 2) return '2 / 1 / 3 / 2'; // Bottom left
    if (index === 3) return '2 / 2 / 2.5 / 3'; // Bottom right top
    return '2.5 / 2 / 3 / 3'; // Bottom right bottom
  }

  // Six images - quarters plus both right cells divided
  if (count === 6) {
    if (index === 0) return '1 / 1 / 2 / 2'; // Top left
    if (index === 1) return '1 / 2 / 1.5 / 3'; // Top right top
    if (index === 2) return '1.5 / 2 / 2 / 3'; // Top right bottom
    if (index === 3) return '2 / 1 / 3 / 2'; // Bottom left
    if (index === 4) return '2 / 2 / 2.5 / 3'; // Bottom right top
    return '2.5 / 2 / 3 / 3'; // Bottom right bottom
  }

  // Seven images - quarters plus both right cells and bottom left divided
  if (count === 7) {
    if (index === 0) return '1 / 1 / 2 / 2'; // Top left
    if (index === 1) return '1 / 2 / 1.5 / 3'; // Top right top
    if (index === 2) return '1.5 / 2 / 2 / 3'; // Top right bottom
    if (index === 3) return '2 / 1 / 2.5 / 2'; // Bottom left top
    if (index === 4) return '2.5 / 1 / 3 / 2'; // Bottom left bottom
    if (index === 5) return '2 / 2 / 2.5 / 3'; // Bottom right top
    return '2.5 / 2 / 3 / 3'; // Bottom right bottom
  }

  // Eight images - all cells divided
  if (count === 8) {
    if (index === 0) return '1 / 1 / 1.5 / 2'; // Top left top
    if (index === 1) return '1.5 / 1 / 2 / 2'; // Top left bottom
    if (index === 2) return '1 / 2 / 1.5 / 3'; // Top right top
    if (index === 3) return '1.5 / 2 / 2 / 3'; // Top right bottom
    if (index === 4) return '2 / 1 / 2.5 / 2'; // Bottom left top
    if (index === 5) return '2.5 / 1 / 3 / 2'; // Bottom left bottom
    if (index === 6) return '2 / 2 / 2.5 / 3'; // Bottom right top
    return '2.5 / 2 / 3 / 3'; // Bottom right bottom
  }

  return '';
}

export default MediaGrid;
