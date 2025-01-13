import { Button, Flex, Text } from '@radix-ui/themes';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { AirtableSpaceSelect } from '~/server/db/schema/integrations/airtable';
import { IndexEntryCard } from './IndexEntryCard';

export const NoEntryPlaceholder = ({ space }: { space: AirtableSpaceSelect }) => {
	const [relatedIndices] = trpc.indices.findRelatedIndices.useSuspenseQuery(space.name);
	const trpcUtils = trpc.useUtils();

	const linkSpaceToIndexEntryMutation = trpc.airtable.linkSpaceToIndexEntry.useMutation({
		onSuccess: () => {
			trpcUtils.airtable.getSpaces.invalidate();
		},
	});
	const createIndexEntryMutation = trpc.indices.createIndexEntry.useMutation({
		onSuccess: () => {
			trpcUtils.airtable.getSpaces.invalidate();
		},
	});

	return (
		<div className="flex flex-col gap-4 rounded-2 border border-gray-a4 p-4">
			{relatedIndices.length > 0 ? (
				<>
					<Text>Found similar index entries:</Text>
					<Flex direction="column" gap="2">
						{relatedIndices.map((index) => (
							<IndexEntryCard
								key={index.id}
								index={index}
								action={{
									label: 'Link',
									onClick: () => {
										linkSpaceToIndexEntryMutation.mutate({
											spaceId: space.id,
											indexEntryId: index.id,
										});
									},
								}}
							/>
						))}
					</Flex>
					<Text size="2" color="gray">
						Or create a new entry:
					</Text>
				</>
			) : (
				<Text>No matching index entries found.</Text>
			)}

			<Button
				onClick={async () => {
					createIndexEntryMutation
						.mutateAsync({
							name: toTitleCase(space.name),
							mainType: 'category',
							createdAt: space.contentCreatedAt ?? space.createdAt,
							updatedAt: space.contentUpdatedAt ?? space.updatedAt,
						})
						.then((newEntry) => {
							linkSpaceToIndexEntryMutation.mutate({
								spaceId: space.id,
								indexEntryId: newEntry.id,
							});
						});
				}}
			>
				Create New Index Entry
			</Button>
		</div>
	);
};
