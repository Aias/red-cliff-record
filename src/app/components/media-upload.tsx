import * as React from 'react';
import { forwardRef, useCallback, useRef, useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { z } from 'zod';
import { Spinner } from './spinner'; // Import Spinner
import { Button } from '@/components/ui/button'; // Assuming shadcn Button path
import { cn } from '@/lib/utils'; // Assuming shadcn utility path

// Define a basic schema for image files. Adjust as needed.
const imageFileSchema = z
	.instanceof(File)
	.refine((file) => file.type.startsWith('image/'), 'File must be an image.')
	.refine((file) => file.size < 5 * 1024 * 1024, 'Image must be less than 5MB.'); // Example size limit

type MediaUploadProps = {
	onUpload: (file: File) => void | Promise<void>;
	className?: string;
	// Add other props as needed, e.g., accepted file types, custom validation schema
	validationSchema?: z.ZodSchema<File>;
};

// Use forwardRef to accept a ref
export const MediaUpload = forwardRef<
	HTMLDivElement, // Type of the element the ref points to (the main div)
	MediaUploadProps
>(({ onUpload, className, validationSchema = imageFileSchema }, ref) => {
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
					errorMessage = err.errors[0]?.message ?? errorMessage;
				} else if (err instanceof Error) {
					errorMessage = `Upload failed: ${err.message}`;
				}
				setError(errorMessage);
				setStatusMessage('Drag file here, paste, or click to upload');
				console.error('File validation or upload error:', err);
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
				for (let i = 0; i < items.length; i++) {
					const currentItem = items[i];
					if (currentItem?.kind === 'file') {
						const file = currentItem.getAsFile();
						if (file) {
							e.preventDefault(); // Prevent default paste behavior only if we handle a file
							handleFile(file);
							return; // Handle only the first file found
						}
					}
				}
				// Optionally handle text paste or other data types here
				// setStatusMessage('Pasted content is not a file.');
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
				'flex h-[128px] w-full flex-col items-center justify-center rounded-sm border border-dashed border-border bg-c-mist p-4 text-center transition-colors duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none',
				isDragging && !isLoading ? 'border-primary bg-primary/10' : '', // Only show drag state if not loading
				error ? 'border-destructive' : '',
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
				// accept="image/*" // Example
			/>
			<Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={isLoading}>
				<UploadIcon className="mr-2 h-4 w-4" />
				Upload File
			</Button>
			<p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
				{isLoading && <Spinner className="size-3" />} {/* Show spinner when loading */}
				{error ? (
					<span className="text-destructive">{error}</span>
				) : (
					<span>{statusMessage}</span> // Wrap status message for layout
				)}
			</p>
		</div>
	);
}); // Close forwardRef

MediaUpload.displayName = 'MediaUpload'; // Set display name for DevTools
