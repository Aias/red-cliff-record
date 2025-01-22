import { useEffect, useMemo } from 'react';
import { Heading, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Placeholder } from '~/app/components/Placeholder';
import { formatCreatorDescription } from '~/app/lib/formatting';
import { useSelection } from '~/app/lib/useSelection';
import { trpc } from '~/app/trpc';
import { QueueItemInspector } from './-components/QueueItemInspector';
import { QueueItem } from './-components/QueueListItem';

const SearchSchema = z.object({
	itemId: z.string().optional(),
});

export const Route = createFileRoute('/queue/index/airtable-creators')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getCreators.queryOptions());
	},
	validateSearch: SearchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { itemId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const [creators] = trpc.airtable.getCreators.useSuspenseQuery();
	const { selectedIds, toggleSelection } = useSelection(creators);

	const inspectedCreator = useMemo(() => {
		if (!itemId) return undefined;
		return creators.find((creator) => creator.id === itemId);
	}, [creators, itemId]);

	useEffect(() => {
		console.log(inspectedCreator);
	}, [inspectedCreator]);

	return (
		<main className="flex grow overflow-hidden">
			<div className="flex max-w-xs flex-col gap-4 border-r border-divider py-4">
				<header className="flex flex-col gap-2 px-3">
					<Heading size="3" as="h2">
						Creators Queue
					</Heading>
					<Text size="3" color="gray">
						{creators.length} creators
					</Text>
				</header>
				<ScrollArea scrollbars="vertical">
					<ol className="flex flex-col gap-1 px-3">
						{creators.map((creator) => (
							<li
								key={creator.id}
								className="selectable card"
								onClick={() => navigate({ search: { itemId: creator.id } })}
							>
								<QueueItem
									title={creator.name}
									externalUrl={creator.website}
									description={formatCreatorDescription(
										creator.type,
										creator.professions ?? undefined,
										creator.nationalities ?? undefined
									)}
									selected={selectedIds.has(creator.id)}
									active={creator.id === itemId}
									handleSelect={() => toggleSelection(creator.id)}
								/>
							</li>
						))}
					</ol>
				</ScrollArea>
			</div>
			<div className="flex grow overflow-hidden p-3">
				{inspectedCreator ? (
					<QueueItemInspector item={inspectedCreator} lookup={(item) => item.name} />
				) : (
					<Placeholder>
						<Text size="3" color="gray">
							Select a creator to map.
						</Text>
					</Placeholder>
				)}
			</div>
		</main>
	);
}
