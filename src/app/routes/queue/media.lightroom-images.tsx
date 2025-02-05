import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { AdobeLightroomImageSelect } from '~/server/db/schema/adobe';
import { type MediaInsert, type MediaSelect } from '~/server/db/schema/media';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { MediaEntryForm } from './-forms/MediaEntryForm';

export const Route = createFileRoute('/queue/media/lightroom-images')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.adobe.getLightroomImages.queryOptions({ limit: 50 }));
	},
	component: RouteComponent,
});

const config: QueueConfig<AdobeLightroomImageSelect, MediaSelect, MediaInsert> = {
	name: 'Lightroom Images',
	mapToQueueItem: (image) => ({
		id: image.id,
		title: `${image.fileName}`,
		description: `${image.cameraMake}, ${image.cameraModel}, ${image.cameraLens}. ${image.location}`,
		avatarUrl: image.url2048,
		externalUrl: image.url2048,
		archivedAt: image.archivedAt,
		mappedId: image.mediaId?.toString() ?? null,
	}),
	getOutputDefaults: (image) => ({
		url: image.url2048,
		createdAt: image.captureDate,
		updatedAt: image.updatedAt,
		altText: image.autoTags?.join(', '),
	}),
	getInputId: (image) => image.id,
	getOutputId: (mediaRecord) => mediaRecord.id.toString(),
	getInputTitle: (image) => `${image.cameraMake} ${image.cameraModel} ${image.location}`,
	getOutputTitle: (mediaRecord) => `${mediaRecord.title} (${mediaRecord.type})`,
};

function RouteComponent() {
	const [lightroomImages] = trpc.adobe.getLightroomImages.useSuspenseQuery({ limit: 50 });
	const utils = trpc.useUtils();

	const createMutation = trpc.media.create.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleCreate = (media: AdobeLightroomImageSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(media));

	const linkMutation = trpc.adobe.linkMedia.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleLink = (lightroomImageId: string, mediaId: string) =>
		linkMutation.mutateAsync({ lightroomImageId, mediaId: Number(mediaId) });

	const unlinkMutation = trpc.adobe.unlinkMedia.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleUnlink = (lightroomImageIds: string[]) =>
		unlinkMutation.mutateAsync(lightroomImageIds);

	const archiveMutation = trpc.adobe.setLightroomImageArchiveStatus.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleArchive = (lightroomImageIds: string[]) =>
		archiveMutation.mutateAsync({ lightroomImageIds, shouldArchive: true });

	const unarchiveMutation = trpc.adobe.setLightroomImageArchiveStatus.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleUnarchive = (lightroomImageIds: string[]) =>
		unarchiveMutation.mutateAsync({ lightroomImageIds, shouldArchive: false });

	const deleteOutputMutation = trpc.media.delete.useMutation({
		onSuccess: () => {
			utils.adobe.getLightroomImages.invalidate();
		},
	});
	const handleDeleteOutput = (mediaId: string) => deleteOutputMutation.mutateAsync(Number(mediaId));

	return (
		<QueueLayout
			items={lightroomImages}
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
						utils.adobe.getLightroomImages.invalidate();
						if (utils.media.search.invalidate) {
							utils.media.search.invalidate();
						}
					}}
				/>
			)}
		</QueueLayout>
	);
}
