import { UploadIcon } from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/button';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';
import { Spinner } from './spinner';

const mediaFileSchema = z
  .instanceof(File)
  .refine(
    (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    'File must be an image or a video.'
  );

type MediaUploadProps = {
  onUpload: (file: File) => void | Promise<void>;
  validationSchema?: z.ZodType<File>;
} & ComponentProps<typeof styled.div>;

export const MediaUpload = ({
  onUpload,
  css: cssProp,
  validationSchema = mediaFileSchema,
  ...props
}: MediaUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Drag file here, paste, or click to upload'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (isLoading) return;
      setError(null);
      if (!file) {
        setStatusMessage('No file selected.');
        return;
      }

      setStatusMessage(`Processing ${file.name}...`);
      setIsLoading(true);

      try {
        const validatedFile = validationSchema.parse(file);
        setStatusMessage(`Uploading ${validatedFile.name}...`);
        await onUpload(validatedFile);
        setStatusMessage('Upload successful!');
      } catch (err) {
        let errorMessage = 'Invalid file.';
        if (err instanceof z.ZodError) {
          errorMessage = err.issues[0]?.message ?? errorMessage;
        } else if (err instanceof Error) {
          errorMessage = `Upload failed: ${err.message}`;
        }
        setError(errorMessage);
        setStatusMessage('Drag file here, paste, or click to upload');
        toast.error(errorMessage);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setIsLoading(false);
      }
    },
    [onUpload, validationSchema, isLoading]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isLoading) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [isLoading]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isLoading) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.currentTarget.contains(e.relatedTarget as Node) || e.relatedTarget === null) {
        setIsDragging(false);
        setStatusMessage('Drag file here, paste, or click to upload');
      }
    },
    [isLoading]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isLoading) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      e.dataTransfer.dropEffect = 'copy';
    },
    [isLoading]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (isLoading) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      void handleFile(file);
    },
    [handleFile, isLoading]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (isLoading) return;
      setError(null);
      const items = e.clipboardData?.items;

      if (items) {
        for (const item of Array.from(items)) {
          if (
            item?.kind === 'file' &&
            (item.type.startsWith('image/') || item.type.startsWith('video/'))
          ) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              e.stopPropagation();
              void handleFile(file);
              return;
            }
          }
        }
      }
    },
    [handleFile, isLoading]
  );

  const handleClick = useCallback(() => {
    if (isLoading) return;
    fileInputRef.current?.click();
  }, [isLoading]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      void handleFile(file);
    },
    [handleFile]
  );

  return (
    <styled.div
      tabIndex={0}
      css={css.raw(
        {
          display: 'flex',
          height: '24',
          width: 'full',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5',
          borderRadius: 'sm',
          borderWidth: '1px',
          borderStyle: 'dashed',
          borderColor: 'divider',
          backgroundColor: 'mist',
          padding: '4',
          textAlign: 'center',
          transitionProperty: '[color, background-color, border-color]',
          transitionDuration: '200',
          transitionTimingFunction: 'easeOut.cubic',
          outlineStyle: 'none',
          _focusVisible: {
            outlineWidth: '2px',
            outlineColor: 'focus',
            outlineOffset: '0.5',
            outlineStyle: 'solid',
          },
          _dragging: {
            borderColor: 'main',
            backgroundColor: 'main/10',
          },
          '&[data-error]': {
            layerStyle: 'chromatic',
            colorPalette: 'error',
            borderColor: 'accent',
          },
          _loading: {
            cursor: 'loading',
            pointerEvents: 'none',
            opacity: '0.5',
          },
        },
        cssProp
      )}
      data-dragging={isDragging && !isLoading ? '' : undefined}
      data-error={error ? '' : undefined}
      data-loading={isLoading ? '' : undefined}
      onDragEnter={isLoading ? undefined : handleDragEnter}
      onDragLeave={isLoading ? undefined : handleDragLeave}
      onDragOver={isLoading ? undefined : handleDragOver}
      onDrop={isLoading ? undefined : handleDrop}
      onPaste={isLoading ? undefined : handlePaste}
      aria-label="Media upload zone"
      aria-disabled={isLoading}
      {...props}
    >
      <styled.input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        css={{ srOnly: true }}
        disabled={isLoading}
        accept="image/*,video/*"
      />
      <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={isLoading}>
        <UploadIcon />
        Upload Media
      </Button>
      <styled.p
        css={{
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          textStyle: 'sm',
          color: 'secondary',
        }}
      >
        {isLoading && <Spinner css={{ boxSize: '3' }} />}
        <styled.span
          css={{
            color: error ? 'accent' : 'currentColor',
          }}
        >
          {error ?? statusMessage}
        </styled.span>
      </styled.p>
    </styled.div>
  );
};

MediaUpload.displayName = 'MediaUpload';
