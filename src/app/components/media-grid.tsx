import { Trash2Icon } from 'lucide-react';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { Button } from './button';
import { LazyVideo } from './lazy-video';
import { MediaLightbox } from './media-lightbox';

export interface MediaGridItem {
  id: number;
  type: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

interface MediaGridProps {
  media: readonly MediaGridItem[];
  className?: string;
  onDelete?: (media: MediaGridItem) => void;
}

interface MediaTileProps {
  item: MediaGridItem;
  label: string;
  imageIndex: number | undefined;
  onOpen: (imageIndex: number) => void;
  onDelete?: (media: MediaGridItem) => void;
}

const VIDEO_ASPECT_RATIO = 16 / 9;

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

function getAspectRatio({ width, height }: MediaGridItem) {
  return width && height ? width / height : VIDEO_ASPECT_RATIO;
}

function MediaTile({ item, label, imageIndex, onOpen, onDelete }: MediaTileProps) {
  const isImage = typeof imageIndex === 'number';

  const handleClick = () => {
    if (isImage) onOpen(imageIndex);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isImage) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(imageIndex);
    }
  };

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.(item);
  };

  return (
    <styled.div
      className="group"
      css={{
        position: 'relative',
        flexGrow: '[var(--ratio)]',
        flexBasis: '[calc(var(--ratio) * {sizes.48})]',
        aspectRatio: '[var(--ratio)]',
        maxBlockSize: '96',
        overflow: 'hidden',
        cursor: 'pointer',
        _focusVisible: {
          outlineWidth: '2px',
          outlineColor: 'focus',
          outlineStyle: 'solid',
        },
      }}
      style={{ '--ratio': getAspectRatio(item) }}
      role={isImage ? 'button' : undefined}
      tabIndex={isImage ? 0 : -1}
      aria-label={isImage ? 'View full size' : undefined}
      aria-haspopup={isImage ? 'dialog' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
          aria-label={label}
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
          alt={label}
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
            onClick={handleDelete}
          >
            <Trash2Icon />
          </Button>
        </styled.div>
      )}
    </styled.div>
  );
}

function MediaGrid({ media, className, onDelete }: MediaGridProps) {
  const images = media.filter((item) => item.type === 'image');
  const imageIndexById = new Map(images.map((item, index) => [item.id, index]));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = () => setLightboxIndex(null);

  if (media.length === 0) return null;

  return (
    <styled.div
      className={className}
      css={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'px',
        width: 'full',
        overflow: 'hidden',
        borderRadius: 'md',
        backgroundColor: 'container',
      }}
    >
      {media.map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          label={item.altText || `Media ${index + 1}`}
          imageIndex={imageIndexById.get(item.id)}
          onOpen={setLightboxIndex}
          onDelete={onDelete}
        />
      ))}
      <MediaLightbox
        images={images}
        activeIndex={lightboxIndex}
        onClose={closeLightbox}
        onIndexChange={setLightboxIndex}
      />
    </styled.div>
  );
}

export default MediaGrid;
