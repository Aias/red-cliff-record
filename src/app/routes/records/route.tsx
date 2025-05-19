import { useCallback } from 'react';
import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { ListRecordsInputSchema } from '@/server/api/routers/types';
import { RecordLink } from './-components/record-link';
import { RecordsGrid } from './-components/records-grid';
import { RadioCards, RadioCardsItem } from '@/components/radio-cards';

export const Route = createFileRoute('/records')({
	validateSearch: ListRecordsInputSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context: { trpc, queryClient }, deps: { search } }) => {
		await queryClient.ensureQueryData(trpc.records.list.queryOptions(search));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const { data: recordsList } = trpc.records.list.useQuery(search, {
		placeholderData: (prev) => prev,
	});
	const matches = useMatches();

	// Check if a record is selected by seeing if we're on a record detail route
	const isRecordSelected = matches.some((match) => match.routeId === '/records/$recordId');

	// Find the current record ID from route params
	const getSelectedRecordId = useCallback(() => {
		const recordIdMatch = matches.find((match) => match.routeId === '/records/$recordId');
		return recordIdMatch?.params?.recordId ? Number(recordIdMatch.params.recordId) : null;
	}, [matches]);

	// Calculate the currently selected record ID
	const currentRecordId = getSelectedRecordId();

	const handleValueChange = useCallback(
		(value: string) => {
			navigate({
				to: '/records/$recordId',
				params: { recordId: value },
			});
		},
		[navigate]
	);

	return (
		<main className={`flex basis-full overflow-hidden ${!isRecordSelected ? 'p-3' : ''}`}>
			{isRecordSelected && recordsList ? (
				<>
					<div className="flex min-w-60 shrink grow-0 basis-72 flex-col gap-2 overflow-hidden border-r border-border py-3">
						<header className="flex items-center justify-between px-3">
							<h2 className="text-lg font-medium">
								Records <span className="text-sm text-c-secondary">({recordsList.ids.length})</span>
							</h2>
							<Link to="/records" className="text-sm">
								Index
							</Link>
						</header>
						<RadioCards
							size="xs"
							value={currentRecordId?.toString()}
							onValueChange={handleValueChange}
							className="flex flex-col gap-1 overflow-y-auto px-3"
						>
							{recordsList.ids.map(({ id }) => (
								<RadioCardsItem key={id} value={id.toString()}>
									<RecordLink id={id} className="w-full overflow-hidden" />
								</RadioCardsItem>
							))}
						</RadioCards>
					</div>
					<Outlet />
				</>
			) : (
				<RecordsGrid />
			)}
		</main>
	);
}
