import type { MediaSelect } from '@hozo/schema/media';
import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { styled } from '@/styled-system/jsx';
import { Dialog } from './dialog';

type LightboxImage = Pick<MediaSelect, 'altText' | 'id' | 'url'>;

interface MediaLightboxProps {
  images: LightboxImage[];
  activeIndex: number | null;
  onClose: () => void;
  onIndexChange: (nextIndex: number | null) => void;
}

export function MediaLightbox({ images, activeIndex, onClose, onIndexChange }: MediaLightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const safeIndex = useMemo(() => {
    if (activeIndex === null) return null;
    if (activeIndex < 0 || activeIndex >= images.length) return null;
    return activeIndex;
  }, [activeIndex, images]);

  const currentImage = safeIndex !== null ? images[safeIndex] : undefined;

  const focusContent = useCallback(() => {
    contentRef.current?.focus({ preventScroll: true });
  }, []);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (images.length === 0) return;
      if (nextIndex < 0) {
        onIndexChange(images.length - 1);
        return;
      }
      if (nextIndex >= images.length) {
        onIndexChange(0);
        return;
      }
      onIndexChange(nextIndex);
    },
    [images.length, onIndexChange]
  );

  const handlePrevious = useCallback(() => {
    if (safeIndex === null) return;
    goToIndex(safeIndex - 1);
    focusContent();
  }, [focusContent, goToIndex, safeIndex]);

  const handleNext = useCallback(() => {
    if (safeIndex === null) return;
    goToIndex(safeIndex + 1);
    focusContent();
  }, [focusContent, goToIndex, safeIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }
    },
    [handleNext, handlePrevious]
  );

  if (safeIndex === null || !currentImage) return null;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content
        ref={contentRef}
        tabIndex={0}
        initialFocus={contentRef}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        showCloseButton={false}
        css={{
          width: '[100dvw]',
          maxWidth: '[100dvw]',
          height: '[100dvh]',
          maxHeight: '[100dvh]',
          border: 'none',
          backgroundColor: 'transparent',
          boxShadow: 'none',

          padding: '8',
        }}
      >
        <Dialog.Title css={{ srOnly: true }}>Record Attachments</Dialog.Title>
        <Dialog.Description css={{ srOnly: true }}>
          Full screen view of the image
        </Dialog.Description>
        <styled.figure
          css={{
            pointerEvents: 'none',
            position: 'relative',
            display: 'flex',
            boxSize: 'full',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <styled.img
            src={currentImage.url}
            alt={currentImage.altText ?? 'Record attachment'}
            css={{
              pointerEvents: 'auto',
              maxHeight: '[calc(100vh - 4rem)]',
              maxWidth: '[calc(100vw - 4rem)]',
              borderRadius: 'lg',
              objectFit: 'contain',
              boxShadow: '2xl',
            }}
            loading="lazy"
            decoding="async"
          />
        </styled.figure>
      </Dialog.Content>
    </Dialog.Root>
  );
}
