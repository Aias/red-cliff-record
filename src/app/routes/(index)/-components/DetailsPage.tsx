import { memo } from 'react';
import { Cross1Icon, LinkBreak2Icon } from '@radix-ui/react-icons';
import { Button, Card, Heading, IconButton, Text } from '@radix-ui/themes';
import { MetadataList } from '~/app/components/MetadataList';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { AirtableSpaceSelect } from '~/server/db/schema/integrations';
import { type IndicesSelect } from '~/server/db/schema/main';
import { IndexEntryForm } from './IndexEntryForm';
import { NoEntryPlaceholder } from './NoEntryPlaceholder';

type AirtableSpaceWithIndexEntry = AirtableSpaceSelect & {
	indexEntry: IndicesSelect | null;
};

export const DetailsPage = memo(
	({ space, handleClose }: { space: AirtableSpaceWithIndexEntry; handleClose: () => void }) => {
		const trpcUtils = trpc.useUtils();
		const unlinkSpacesMutation = trpc.airtable.unlinkSpacesFromIndices.useMutation({
			onSuccess: () => {
				trpcUtils.airtable.getSpaces.invalidate();
			},
		});
		const setSpaceArchiveStatusMutation = trpc.airtable.setSpaceArchiveStatus.useMutation({
			onSuccess: () => {
				trpcUtils.airtable.getSpaces.invalidate();
			},
		});

		return (
			<Card className="flex shrink basis-full gap-2">
				<section className="flex w-sm flex-col gap-4">
					<header className="flex items-center justify-between">
						<Heading size="4">Selected Space</Heading>
						{space.indexEntryId && (
							<IconButton
								size="1"
								variant="soft"
								color="red"
								onClick={() => {
									unlinkSpacesMutation.mutate([space.id]);
								}}
							>
								<LinkBreak2Icon className="h-4 w-4" />
							</IconButton>
						)}
					</header>
					{!space ? <Text>Not Found.</Text> : <MetadataList metadata={space} />}
					<Button
						variant="soft"
						onClick={() =>
							setSpaceArchiveStatusMutation.mutate({
								spaceIds: [space.id],
								shouldArchive: !space.archivedAt,
							})
						}
					>
						{space.archivedAt ? 'Unarchive' : 'Archive'}
					</Button>
				</section>
				<section className="ml-3 flex grow flex-col gap-4 border-l border-divider pl-3">
					<div className="flex items-center justify-between">
						<Heading size="4">Index Entry</Heading>
						<IconButton size="1" variant="soft" onClick={handleClose}>
							<Cross1Icon />
						</IconButton>
					</div>
					{space.indexEntry ? (
						<IndexEntryForm
							indexEntry={space.indexEntry}
							defaults={{
								name: toTitleCase(space.name),
								notes: space.fullName,
								createdAt: space.contentCreatedAt ?? undefined,
								updatedAt: space.contentUpdatedAt ?? undefined,
								mainType: 'category',
							}}
						/>
					) : (
						<NoEntryPlaceholder space={space} />
					)}
				</section>
			</Card>
		);
	}
);
