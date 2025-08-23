import * as React from 'react';
import { forwardRef, useCallback, useRef, useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod/v4';
import { Spinner } from './spinner';
import { Button } from '@/components/button';
import { cn } from '@/lib/utils';

const mediaFileSchema = z
	.instanceof(File)
	.refine(
		(file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
		'File must be an image or a video.'
	);

type MediaUploadProps = {
	onUpload: (file: File) => void | Promise<void>;
	className?: string;
	validationSchema?: z.ZodSchema<File>;
};

export const MediaUpload = forwardRef<HTMLDivElement, MediaUploadProps>(
	({ onUpload, className, validationSchema = mediaFileSchema }, ref) => {
		const [isDragging, setIsDragging] = useState(false);
		const [isLoading, setIsLoading] = useState(false); // Add loading state
		const [error, setError] = useState<string | null>(null);
		const [statusMessage, setStatusMessage] = useState<string>(
			'Drag file here, paste, or click to upload'
		);
		const fileInputRef = useRef<HTMLInputElement>(null);

		const handleFile = useCallback(
			async (file: File | null) => {
				if (isLoading) return; // Prevent handling if already loading
				setError(null);
				if (!file) {
					setStatusMessage('No file selected.');
					return;
				}

				setStatusMessage(`Processing ${file.name}...`);
				setIsLoading(true); // Set loading state to true

				try {
					const validatedFile = validationSchema.parse(file);
					setStatusMessage(`Uploading ${validatedFile.name}...`);
					await onUpload(validatedFile);
					setStatusMessage('Upload successful!');
					// Optionally reset after a delay
					// setTimeout(() => setStatusMessage('Drag file here, paste, or click to upload'), 2000);
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
					// Reset file input to allow uploading the same file again
					if (fileInputRef.current) {
						fileInputRef.current.value = '';
					}
					setIsLoading(false); // Set loading state to false
				}
			},
			[onUpload, validationSchema, isLoading] // Include isLoading in dependencies
		);

		const handleDragEnter = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				if (isLoading) return;
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(true);
			},
			[isLoading]
		);

		const handleDragLeave = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				if (isLoading) return;
				e.preventDefault();
				e.stopPropagation();
				// Only set isDragging to false if the leave target is outside the component itself
				if (!e.currentTarget.contains(e.relatedTarget as Node) || e.relatedTarget === null) {
					setIsDragging(false);
					setStatusMessage('Drag file here, paste, or click to upload');
				}
			},
			[isLoading]
		);

		const handleDragOver = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				if (isLoading) return;
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(true); // Keep highlighting while dragging over
				e.dataTransfer.dropEffect = 'copy'; // Indicate it's a copy operation
			},
			[isLoading]
		);

		const handleDrop = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				if (isLoading) return;
				e.preventDefault();
				e.stopPropagation();
				setIsDragging(false);
				const file = e.dataTransfer.files?.[0] ?? null;
				handleFile(file);
			},
			[handleFile, isLoading]
		);

		const handlePaste = useCallback(
			(e: React.ClipboardEvent<HTMLDivElement>) => {
				if (isLoading) return;
				setError(null);
				const items = e.clipboardData?.items;

				if (items) {
					// Prioritize specific image/video types if needed, or handle generally
					for (const item of Array.from(items)) {
						if (
							item?.kind === 'file' &&
							(item.type.startsWith('image/') || item.type.startsWith('video/'))
						) {
							const file = item.getAsFile();
							if (file) {
								e.preventDefault();
								handleFile(file);
								return; // Handle the first valid file found
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
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const file = e.target.files?.[0] ?? null;
				handleFile(file);
			},
			[handleFile]
		);

		return (
			<div
				// Make the div focusable and apply focus ring styles directly to it
				ref={ref} // Attach the forwarded ref here
				tabIndex={0}
				className={cn(
					'flex h-24 w-full flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-c-divider bg-c-mist p-4 text-center transition-colors duration-200 focus:ring-2 focus:ring-c-focus focus:ring-offset-2 focus:outline-none',
					isDragging && !isLoading ? 'border-c-main bg-c-main/10' : '', // Only show drag state if not loading
					error ? 'border-c-destructive' : '',
					isLoading ? 'cursor-not-allowed opacity-50' : '', // Apply disabled styles when loading
					className
				)}
				onDragEnter={isLoading ? undefined : handleDragEnter} // Disable event handlers when loading
				onDragLeave={isLoading ? undefined : handleDragLeave}
				onDragOver={isLoading ? undefined : handleDragOver}
				onDrop={isLoading ? undefined : handleDrop}
				onPaste={isLoading ? undefined : handlePaste}
				aria-label="Media upload zone"
				aria-disabled={isLoading} // Indicate disabled state for accessibility
			>
				<input
					type="file"
					ref={fileInputRef}
					onChange={handleFileChange}
					className="hidden"
					disabled={isLoading} // Disable hidden input
					// Consider adding 'accept' attribute based on validationSchema if possible
					accept="image/*,video/*" // Accept both image and video files
				/>
				<Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={isLoading}>
					<UploadIcon className="mr-2 h-4 w-4" />
					Upload Media
				</Button>
				<p className="flex items-center gap-1 text-sm text-c-secondary">
					{isLoading && <Spinner className="size-3" />} {/* Show spinner when loading */}
					{error ? (
						<span className="text-c-destructive">{error}</span>
					) : (
						<span>{statusMessage}</span> // Wrap status message for layout
					)}
				</p>
			</div>
		);
	}
); // Close forwardRef

MediaUpload.displayName = 'MediaUpload'; // Set display name for DevTools
