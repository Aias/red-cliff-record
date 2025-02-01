import { useEffect } from 'react';
import { Button, ScrollArea, Text, TextField } from '@radix-ui/themes';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { MetadataList } from '~/app/components/MetadataList';
import { trpc } from '~/app/trpc';
import { MediaSelectSchema, type MediaSelect } from '~/server/db/schema/main';

type MediaEntryFormProps = {
	mediaId: string | number;
	defaults: Partial<MediaSelect>;
	updateCallback?: (data: MediaSelect) => Promise<void>;
};

export const MediaEntryForm: React.FC<MediaEntryFormProps> = ({
	mediaId,
	defaults: _defaults,
	updateCallback,
}) => {
	// Coerce the provided id to a number before querying.
	const id = z.coerce.number().parse(mediaId);
	const [mediaItem] = trpc.media.get.useSuspenseQuery(id);
	const utils = trpc.useUtils();

	const updateMediaMutation = trpc.media.update.useMutation({
		onSuccess: async () => {
			utils.media.get.invalidate();
			if (updateCallback) {
				await updateCallback(form.state.values);
			}
		},
	});

	const form = useForm({
		defaultValues: mediaItem,
		onSubmit: async ({ value }) => {
			updateMediaMutation.mutate(value);
		},
		validators: {
			onChange: MediaSelectSchema,
		},
	});

	useEffect(() => {
		form.reset(mediaItem);
	}, [mediaItem]);

	let mediaPreview;
	if (mediaItem.mimeType.startsWith('image')) {
		mediaPreview = (
			<img
				src={mediaItem.url}
				alt={mediaItem.altText || mediaItem.title || undefined}
				className="w-full rounded shadow"
			/>
		);
	} else if (mediaItem.mimeType.startsWith('video')) {
		mediaPreview = <video controls src={mediaItem.url} className="w-full rounded shadow" />;
	} else {
		mediaPreview = <div className="bg-muted rounded p-4">Preview not available</div>;
	}

	return (
		<div className="flex basis-full flex-col gap-4 overflow-hidden">
			{/* Display the actual media preview above the edit form */}
			<div className="mb-4">{mediaPreview}</div>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<form.Field name="url">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									URL
								</Text>
								<TextField.Root
									type="text"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>
					<form.Field name="title">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									Title
								</Text>
								<TextField.Root
									type="text"
									value={field.state.value || ''}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>
					<form.Field name="altText">
						{(field) => (
							<label className="flex flex-col gap-1">
								<Text size="2" color="gray">
									Alt Text
								</Text>
								<TextField.Root
									type="text"
									value={field.state.value || ''}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</label>
						)}
					</form.Field>
				</div>
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<div className="mt-4 border-t border-divider pt-4">
							<Button type="submit" disabled={!canSubmit}>
								{isSubmitting ? '...Saving' : 'Save Changes'}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
			<ScrollArea scrollbars="vertical">
				<MetadataList metadata={mediaItem} />
			</ScrollArea>
		</div>
	);
};
