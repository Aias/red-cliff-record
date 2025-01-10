import { memo } from 'react';
import { Cross1Icon, LinkBreak2Icon } from '@radix-ui/react-icons';
import { Button, Card, Heading, IconButton, Text } from '@radix-ui/themes';
import { useQueryClient } from '@tanstack/react-query';
import { MetadataList } from '@/app/components/MetadataList';
import { toTitleCase } from '@/app/lib/formatting';
import type { AirtableSpaceSelect } from '@schema/integrations';
import {
	setSpaceArchiveStatus,
	unlinkIndexEntries,
	type AirtableSpaceWithIndexEntry,
} from '../-queries';
import { IndexEntryForm } from './IndexEntryForm';
import { NoEntryPlaceholder } from './NoEntryPlaceholder';

export const DetailsPage = memo(
	({ space, handleClose }: { space: AirtableSpaceWithIndexEntry; handleClose: () => void }) => {
		const queryClient = useQueryClient();

		return (
			<Card className="flex gap-2 shrink basis-full">
				<section className="flex flex-col w-sm gap-4">
					<header className="flex justify-between items-center">
						<Heading size="4">Selected Space</Heading>
						{space.indexEntryId && (
							<IconButton
								size="1"
								variant="soft"
								color="red"
								onClick={() => {
									unlinkIndexEntries({ data: [space.id] }).then(() => {
										queryClient.invalidateQueries({
											queryKey: ['index', 'airtable'],
										});
									});
								}}
							>
								<LinkBreak2Icon className="w-4 h-4" />
							</IconButton>
						)}
					</header>
					{!space ? <Text>Not Found.</Text> : <MetadataList metadata={space} />}
					<Button
						variant="soft"
						onClick={() =>
							setSpaceArchiveStatus({
								data: { ids: [space.id], shouldArchive: !space.archivedAt },
							}).then(() => {
								queryClient.invalidateQueries({
									queryKey: ['index', 'airtable'],
								});
							})
						}
					>
						{space.archivedAt ? 'Unarchive' : 'Archive'}
					</Button>
				</section>
				<section className="flex flex-col gap-4 grow pl-3 ml-3 border-l border-divider">
					<div className="flex justify-between items-center">
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
							updateCallback={(indexEntry) => {
								queryClient.setQueryData(
									['index', 'airtable', 'spaces'],
									(oldData: AirtableSpaceSelect[]) => {
										return oldData.map((space) =>
											space.indexEntryId === indexEntry.id
												? { ...space, indexEntry: indexEntry }
												: space
										);
									}
								);
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
