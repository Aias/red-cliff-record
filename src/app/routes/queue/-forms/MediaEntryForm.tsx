import React, { useState } from 'react';
import { trpc } from '~/app/trpc';
import { Text, Button, TextField } from '@radix-ui/themes';

interface MediaDefaults {
	url: string;
	format: string;
	mimeType: string;
	title: string;
	altText: string;
	fileSize?: number;
	width?: number;
	height?: number;
	createdAt: string;
	updatedAt: string;
}

interface MediaFormProps {
	defaults: MediaDefaults;
	mediaId: string | null;
	updateCallback: () => Promise<void>;
}

export const MediaForm: React.FC<MediaFormProps> = ({
	defaults,
	mediaId,
	updateCallback,
}) => {
	const [formData, setFormData] = useState<MediaDefaults>(defaults);
	const createMedia = trpc.media.create.useMutation();

	const handleChange = (field: keyof MediaDefaults) => (
		e: React.ChangeEvent<HTMLTextField.RootElement>
	) => {
		const value =
			field === 'fileSize' || field === 'width' || field === 'height'
				? Number(e.target.value)
				: e.target.value;
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			await createMedia.mutateAsync(formData);
			await updateCallback();
		} catch (error) {
			console.error('Error creating media record:', error);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="grid gap-4 p-4">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
				<label htmlFor="url">URL</label>
				<TextField.Root
					id="url"
					type="text"
					value={formData.url}
					onChange={handleChange('url')}
				/>

				<label htmlFor="format">Format</label>
				<TextField.Root
					id="format"
					type="text"
					value={formData.format}
					onChange={handleChange('format')}
				/>

				<label htmlFor="mimeType">MIME Type</label>
				<TextField.Root
					id="mimeType"
					type="text"
					value={formData.mimeType}
					onChange={handleChange('mimeType')}
				/>

				<label htmlFor="title">Title</label>
				<TextField.Root
					id="title"
					type="text"
					value={formData.title}
					onChange={handleChange('title')}
				/>

				<label htmlFor="altText">Alt Text</label>
				<TextField.Root
					id="altText"
					type="text"
					value={formData.altText}
					onChange={handleChange('altText')}
				/>

				<label htmlFor="fileSize">File Size</label>
				<TextField.Root
					id="fileSize"
					type="number"
					value={formData.fileSize ?? ''}
					onChange={handleChange('fileSize')}
				/>

				<label htmlFor="width">Width</label>
				<TextField.Root
					id="width"
					type="number"
					value={formData.width ?? ''}
					onChange={handleChange('width')}
				/>

				<label htmlFor="height">Height</label>
				<TextField.Root
					id="height"
					type="number"
					value={formData.height ?? ''}
					onChange={handleChange('height')}
				/>
			</div>
			<Button type="submit">Submit</Button>
		</form>
	);
};