import { useEffect } from 'react';
import { Button, TextArea, TextField } from '@radix-ui/themes';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { MediaSelectSchema, type MediaSelect } from '@/server/db/schema/media';

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
	if (mediaItem.type === 'image') {
		mediaPreview = (
			<img
				src={mediaItem.url}
				alt={mediaItem.altText || undefined}
				className="w-full rounded shadow"
			/>
		);
	} else if (mediaItem.type === 'video') {
		mediaPreview = <video controls src={mediaItem.url} className="w-full rounded shadow" />;
	} else {
		mediaPreview = <div className="bg-muted rounded p-4">Preview not available</div>;
	}

	return (
		<div className="flex basis-full flex-col gap-4 overflow-hidden">
			<div className="mb-4">{mediaPreview}</div>
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="url">
					{(field) => (
						<label className="flex flex-col gap-1">
							<span className="text-sm text-secondary">URL</span>
							<TextField.Root
								type="url"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>
				<form.Field name="altText">
					{(field) => (
						<label className="flex flex-col gap-1">
							<span className="text-sm text-secondary">Alt Text</span>
							<TextArea
								value={field.state.value || ''}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</label>
					)}
				</form.Field>
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
		</div>
	);
};
