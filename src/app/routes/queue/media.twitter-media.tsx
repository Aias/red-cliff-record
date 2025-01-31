import { createFileRoute } from '@tanstack/react-router';
import { getMediaFormatFromURL, getMimeTypeFromURL } from '~/app/lib/content-helpers';
import { trpc } from '~/app/trpc';
import type { TwitterMediaSelect } from '~/server/db/schema/integrations/twitter';
import { type MediaInsert, type MediaSelect } from '~/server/db/schema/main/media';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { MediaForm } from './-forms/MediaEntryForm';

export const Route = createFileRoute('/queue/media/twitter-media')({
	loader: async ({ context: { queryClient, trpc } }) => {
		// Ensure we load twitter media records (default limit of 50)
		await queryClient.ensureQueryData(trpc.twitter.getMedia.queryOptions({ limit: 50 }));
	},
	component: RouteComponent,
});

const config: QueueConfig<TwitterMediaSelect, MediaSelect, MediaInsert> = {
	name: 'Twitter Media',
	mapToQueueItem: (media) => ({
		id: media.id,
		title: media.type,
		description: media.url,
		externalUrl: media.mediaUrl,
		archivedAt: media.archivedAt,
		mappedId: media.mediaId ? media.mediaId.toString() : null,
	}),
	getOutputDefaults: (media) => ({
		url: media.mediaUrl,
		format: getMediaFormatFromURL(media.mediaUrl),
		mimeType: getMimeTypeFromURL(media.mediaUrl),
		title: undefined,
		altText: undefined,
		fileSize: undefined,
		width: undefined,
		height: undefined,
		createdAt: media.createdAt,
		updatedAt: media.updatedAt,
	}),
	getInputId: (media) => media.id,
	getOutputId: (mediaRecord) => mediaRecord.id.toString(),
	getInputTitle: (media) => media.type,
	getOutputTitle: (mediaRecord) => `${mediaRecord.title} (${mediaRecord.mimeType})`,
};

function RouteComponent() {
	// Fetch Twitter media with a fixed limit (using the same query parameters as the loader)
	const mediaItems = trpc.twitter.getMedia.useSuspenseQuery({ limit: 50 });
	const utils = trpc.useUtils();

	const createMutation = trpc.media.create.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
			// Invalidate search or list query for media if you have one
		},
	});
	const handleCreate = (media: TwitterMediaSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(media));

	return (
		<QueueLayout
			items={mediaItems}
			config={config}
			handleSearch={utils.media.search.fetch}
			handleCreate={handleCreate}
			// For media we’re just creating new records via the form.
			// No link/unlink, archive/unarchive operations are implemented here.
			handleLink={null}
			handleUnlink={null}
			handleArchive={null}
			handleUnarchive={null}
		>
			{(mappedId, defaults) => (
				<MediaForm
					defaults={defaults}
					mediaId={mappedId}
					updateCallback={async () => {
						utils.twitter.getMedia.invalidate();
						if (utils.media.search.invalidate) {
							utils.media.search.invalidate();
						}
					}}
				/>
			)}
		</QueueLayout>
	);
}
