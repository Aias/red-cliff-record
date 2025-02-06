import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { AirtableAttachmentSelect } from '~/server/db/schema/airtable';
import type { MediaInsert, MediaSelect } from '~/server/db/schema/media';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { MediaEntryForm } from './-forms/MediaEntryForm';

export const Route = createFileRoute('/queue/media/airtable-attachments')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getAttachments.queryOptions({ limit: 50 }));
	},
	component: RouteComponent,
});

const config: QueueConfig<AirtableAttachmentSelect, MediaSelect, MediaInsert> = {
	name: 'Airtable Attachments',
	mapToQueueItem: (attachment) => ({
		id: attachment.id,
		title: attachment.filename,
		description: `${attachment.type ?? 'Unknown Type'} - ${attachment.width ? `${attachment.width}x${attachment.height}` : ''} ${attachment.size ? `(${attachment.size} bytes)` : ''}`,
		avatarUrl: attachment.url,
		externalUrl: attachment.url,
		archivedAt: attachment.archivedAt,
		mappedId: attachment.mediaId ? attachment.mediaId.toString() : null,
	}),
	getOutputDefaults: (attachment) => ({
		url: attachment.url,
		recordCreatedAt: attachment.recordCreatedAt,
		recordUpdatedAt: attachment.recordUpdatedAt,
		altText: attachment.filename,
	}),
	getInputId: (attachment) => attachment.id,
	getOutputId: (mediaRecord) => mediaRecord.id.toString(),
	getInputTitle: (attachment) => attachment.filename,
	getOutputTitle: (mediaRecord) => `${mediaRecord.title} (${mediaRecord.type})`,
};

function RouteComponent() {
	const [attachments] = trpc.airtable.getAttachments.useSuspenseQuery({ limit: 50 });
	const utils = trpc.useUtils();

	const createMutation = trpc.media.create.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleCreate = (attachment: AirtableAttachmentSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(attachment));

	const linkMutation = trpc.airtable.linkMedia.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleLink = (attachmentId: string, mediaId: string) =>
		linkMutation.mutateAsync({ attachmentId, mediaId: Number(mediaId) });

	const unlinkMutation = trpc.airtable.unlinkMedia.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleUnlink = (attachmentIds: string[]) => unlinkMutation.mutateAsync(attachmentIds);

	const archiveMutation = trpc.airtable.setAttachmentsArchiveStatus.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleArchive = (attachmentIds: string[]) =>
		archiveMutation.mutateAsync({ attachmentIds, shouldArchive: true });

	const unarchiveMutation = trpc.airtable.setAttachmentsArchiveStatus.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleUnarchive = (attachmentIds: string[]) =>
		unarchiveMutation.mutateAsync({ attachmentIds, shouldArchive: false });

	const deleteOutputMutation = trpc.media.delete.useMutation({
		onSuccess: () => {
			utils.airtable.getAttachments.invalidate();
		},
	});
	const handleDeleteOutput = (mediaId: string) => deleteOutputMutation.mutateAsync(Number(mediaId));

	return (
		<QueueLayout
			items={attachments}
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
						utils.airtable.getAttachments.invalidate();
						if (utils.media.search.invalidate) {
							utils.media.search.invalidate();
						}
					}}
				/>
			)}
		</QueueLayout>
	);
}
