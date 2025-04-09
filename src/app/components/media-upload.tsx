import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { z } from 'zod';
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

export function MediaUpload({
	onUpload,
	className,
	validationSchema = imageFileSchema,
}: MediaUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string>(
		'Drag file here, paste, or click to upload'
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		async (file: File | null) => {
			setError(null);
			if (!file) {
				setStatusMessage('No file selected.');
				return;
			}

			setStatusMessage(`Processing ${file.name}...`);

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
			}
		},
		[onUpload, validationSchema]
	);

	const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
		setError(null);
		setStatusMessage('Drop the file here');
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		// Only set isDragging to false if the leave target is outside the component itself
		if (!e.currentTarget.contains(e.relatedTarget as Node) || e.relatedTarget === null) {
			setIsDragging(false);
			setStatusMessage('Drag file here, paste, or click to upload');
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true); // Keep highlighting while dragging over
		e.dataTransfer.dropEffect = 'copy'; // Indicate it's a copy operation
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const file = e.dataTransfer.files?.[0] ?? null;
			handleFile(file);
		},
		[handleFile]
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLDivElement>) => {
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
		[handleFile]
	);

	const handleClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0] ?? null;
			handleFile(file);
		},
		[handleFile]
	);

	return (
		<div
			className={cn(
				'flex h-[128px] w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-c-mist p-4 text-center transition-colors duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none',
				isDragging ? 'border-primary bg-primary/10' : '',
				error ? 'border-destructive' : '',
				className
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			onPaste={handlePaste}
			aria-label="Media upload zone"
		>
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleFileChange}
				className="hidden"
				// Consider adding 'accept' attribute based on validationSchema if possible
				// accept="image/*" // Example
			/>
			<Button variant="ghost" size="sm" onClick={handleClick}>
				<UploadIcon className="mr-2 h-4 w-4" />
				Upload File
			</Button>
			<p className="text-sm text-muted-foreground">
				{error ? <span className="text-destructive">{error}</span> : statusMessage}
			</p>
		</div>
	);
}
