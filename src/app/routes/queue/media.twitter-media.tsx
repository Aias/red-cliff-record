import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { TwitterMediaSelect, TwitterTweetSelect } from '~/server/db/schema/twitter';
import { type MediaInsert, type MediaSelect } from '~/server/db/schema/media';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { MediaEntryForm } from './-forms/MediaEntryForm';

type TwitterMediaWithTweet = TwitterMediaSelect & {
	tweet?: TwitterTweetSelect;
};

export const Route = createFileRoute('/queue/media/twitter-media')({
	loader: async ({ context: { queryClient, trpc } }) => {
		// Ensure we load twitter media records (default limit of 50)
		await queryClient.ensureQueryData(trpc.twitter.getMedia.queryOptions({ limit: 50 }));
	},
	component: RouteComponent,
});

const config: QueueConfig<TwitterMediaWithTweet, MediaSelect, MediaInsert> = {
	name: 'Twitter Media',
	mapToQueueItem: (media) => ({
		id: media.id,
		title: `#${media.tweet?.id}`,
		description: media.tweet?.text?.slice(0, 100),
		avatarUrl: media.thumbnailUrl ?? media.mediaUrl,
		externalUrl: media.tweetUrl,
		archivedAt: media.archivedAt,
		mappedId: media.mediaId ? media.mediaId.toString() : null,
	}),
	getOutputDefaults: (media) => ({
		url: media.mediaUrl,
		createdAt: media.tweet?.contentCreatedAt ?? media.createdAt,
		updatedAt: media.tweet?.contentUpdatedAt ?? media.updatedAt,
	}),
	getInputId: (media) => media.id,
	getOutputId: (mediaRecord) => mediaRecord.id.toString(),
	getInputTitle: (media) => `Media from Tweet: #${media.tweet?.id}`,
	getOutputTitle: (mediaRecord) => `${mediaRecord.title} (${mediaRecord.type})`,
};

function RouteComponent() {
	// Fetch Twitter media with a fixed limit (using the same query parameters as the loader)
	const [mediaItems] = trpc.twitter.getMedia.useSuspenseQuery({ limit: 50 });
	const utils = trpc.useUtils();

	const createMutation = trpc.media.create.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
			// Invalidate search or list query for media if you have one
		},
	});
	const handleCreate = (media: TwitterMediaWithTweet) =>
		createMutation.mutateAsync(config.getOutputDefaults(media));

	const linkMutation = trpc.twitter.linkMedia.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
		},
	});
	const handleLink = (twitterId: string, mediaId: string) =>
		linkMutation.mutateAsync({ twitterId, mediaId: Number(mediaId) });

	const unlinkMutation = trpc.twitter.unlinkMedia.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
		},
	});
	const handleUnlink = (twitterIds: string[]) => unlinkMutation.mutateAsync(twitterIds);

	const archiveMutation = trpc.twitter.setMediaArchiveStatus.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
		},
	});
	const handleArchive = (twitterMediaIds: string[]) =>
		archiveMutation.mutateAsync({ twitterMediaIds, shouldArchive: true });

	const unarchiveMutation = trpc.twitter.setMediaArchiveStatus.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
		},
	});
	const handleUnarchive = (twitterMediaIds: string[]) =>
		unarchiveMutation.mutateAsync({ twitterMediaIds, shouldArchive: false });

	const deleteOutputMutation = trpc.media.delete.useMutation({
		onSuccess: () => {
			utils.twitter.getMedia.invalidate();
		},
	});
	const handleDeleteOutput = (mediaId: string) => deleteOutputMutation.mutateAsync(Number(mediaId));

	return (
		<QueueLayout
			items={mediaItems}
			config={config}
			handleSearch={utils.media.search.fetch}
			handleCreate={handleCreate}
			handleLink={handleLink}
			handleUnlink={handleUnlink}
			handleArchive={handleArchive}
			handleUnarchive={handleUnarchive}
			handleDeleteOutput={handleDeleteOutput}
		>
			{(mappedId, defaults) => (
				<MediaEntryForm
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
