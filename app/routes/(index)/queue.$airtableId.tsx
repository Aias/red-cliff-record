import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, Card, Heading, IconButton, Text } from '@radix-ui/themes';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AppLink } from '@/app/components/AppLink';
import { MetadataList } from '@/app/components/MetadataList';
import { invalidateQueries } from '@/app/lib/query-helpers';
import { IndexEntryForm } from './-components/IndexEntryForm';
import { NoEntryPlaceholder } from './-components/NoEntryPlaceholder';
import { airtableSpaceByIdQueryOptions, setSpaceArchiveStatus } from './-queries';

export const Route = createFileRoute('/(index)/queue/$airtableId')({
	component: RouteComponent,
	loader: ({ params, context }) =>
		context.queryClient.ensureQueryData(airtableSpaceByIdQueryOptions(params.airtableId)),
});

function RouteComponent() {
	const { airtableId } = Route.useParams();
	const { data: space } = useSuspenseQuery(airtableSpaceByIdQueryOptions(airtableId));
	const queryClient = useQueryClient();

	return (
		<Card className="flex gap-2 shrink basis-full">
			<div className="flex flex-col w-sm gap-4">
				<Heading size="4">Selected Space</Heading>
				{!space ? <Text>Not Found.</Text> : <MetadataList metadata={space} />}
				<Button
					variant="soft"
					onClick={() =>
						setSpaceArchiveStatus({
							data: { ids: [space.id], shouldArchive: !space.archivedAt },
						}).then(() => {
							invalidateQueries(queryClient, [
								['archiveQueueLength'],
								['airtableSpaceById', space.id],
								['airtableSpaces'],
							]);
						})
					}
				>
					{space.archivedAt ? 'Unarchive' : 'Archive'}
				</Button>
			</div>
			<div className="flex flex-col gap-4 grow pl-3 ml-3 border-l border-divider">
				<div className="flex justify-between items-center">
					<Heading size="4">Index Entry</Heading>
					<AppLink asChild to={'/queue'}>
						<IconButton size="1" variant="soft">
							<Cross1Icon />
						</IconButton>
					</AppLink>
				</div>
				{space.indexEntry ? (
					<IndexEntryForm indexEntry={space.indexEntry} space={space} />
				) : (
					<NoEntryPlaceholder space={space} />
				)}
			</div>
		</Card>
	);
}
