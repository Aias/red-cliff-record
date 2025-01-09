import { Button, Text } from '@radix-ui/themes';
import { useQueryClient } from '@tanstack/react-query';
import type { AirtableSpaceSelect } from '@/db/schema/integrations/airtable';
import { createIndexEntryFromAirtableSpace } from '../-queries';

export const NoEntryPlaceholder = ({ space }: { space: AirtableSpaceSelect }) => {
	const queryClient = useQueryClient();
	return (
		<div className="rounded-2 p-4 align-center justify-center flex flex-col border border-gray-a4 text-center gap-2">
			<Text>No index entry found for this space.</Text>
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
				Create Index Entry
			</Button>
		</div>
	);
};
