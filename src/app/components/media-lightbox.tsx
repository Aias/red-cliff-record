import type { MediaSelect } from '@hozo/schema/media';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';

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
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          onClick={onClose}
          className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          ref={contentRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusContent();
          }}
          className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center p-8 outline-hidden"
        >
          <DialogPrimitive.Title className="sr-only">Record Attachments</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full screen view of the image
          </DialogPrimitive.Description>
          <figure className="pointer-events-none relative flex h-full w-full items-center justify-center">
            <img
              src={currentImage.url}
              alt={currentImage.altText ?? 'Record attachment'}
              className="pointer-events-auto max-h-[calc(100vh-4rem)] max-w-[calc(100vw-4rem)] rounded-lg object-contain shadow-2xl"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
