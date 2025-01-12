import { Button, Flex, Text } from '@radix-ui/themes';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { AirtableSpaceSelect } from '~/server/db/schema/integrations/airtable';
import {
	createIndexEntryFromAirtableSpace,
	linkSpaceToIndexEntry,
	relatedIndicesQueryOptions,
} from '../-queries';
import { IndexEntryCard } from './IndexEntryCard';

export const NoEntryPlaceholder = ({ space }: { space: AirtableSpaceSelect }) => {
	const queryClient = useQueryClient();
	const { data: relatedIndices } = useSuspenseQuery(relatedIndicesQueryOptions(space.name));

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
										linkSpaceToIndexEntry({
											data: { spaceId: space.id, indexEntryId: index.id },
										}).then(() => {
											queryClient.invalidateQueries({
												queryKey: ['index', 'airtable', 'spaces'],
											});
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
					const { indexEntry: newIndexEntry, airtableSpace: updatedAirtableSpace } =
						await createIndexEntryFromAirtableSpace({ data: space });
					queryClient.setQueryData(['airtableSpaceById', space.id], {
						...updatedAirtableSpace,
						indexEntryId: newIndexEntry.id,
						indexEntry: newIndexEntry,
					});
					queryClient.setQueryData(['airtableSpaces'], (oldData: AirtableSpaceSelect[]) => {
						return oldData.map((oldSpace) =>
							oldSpace.id === space.id
								? {
										...updatedAirtableSpace,
										indexEntryId: newIndexEntry.id,
										indexEntry: newIndexEntry,
									}
								: oldSpace
						);
					});
				}}
			>
				Create New Index Entry
			</Button>
		</div>
	);
};
