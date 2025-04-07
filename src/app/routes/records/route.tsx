import { useCallback, useMemo } from 'react';
import { createContext } from 'react';
import {
	createFileRoute,
	Link,
	Outlet,
	retainSearchParams,
	useMatches,
} from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { ListRecordsInputSchema } from '@/server/api/routers/records.types';
import { RecordsGrid } from './-components/records-grid';
import { RecordLink } from './-components/relations';

// Create context for sharing data between parent and child routes
export const NextRecordIdContext = createContext<number | undefined>(undefined);

export const Route = createFileRoute('/records')({
	validateSearch: ListRecordsInputSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context: { trpc, queryClient }, deps: { search } }) => {
		await queryClient.ensureQueryData(trpc.records.list.queryOptions(search));
	},
	component: RouteComponent,
	search: {
		middlewares: [retainSearchParams(true)],
	},
});

function RouteComponent() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const [recordsList] = trpc.records.list.useSuspenseQuery(search);
	const matches = useMatches();

	// Check if a record is selected by seeing if we're on a record detail route
	const isRecordSelected = matches.some((match) => match.routeId === '/records/$recordId');

	// Find the current record ID from route params
	const getSelectedRecordId = useCallback(() => {
		const recordIdMatch = matches.find((match) => match.routeId === '/records/$recordId');
		return recordIdMatch?.params?.recordId ? Number(recordIdMatch.params.recordId) : null;
	}, [matches]);

	// Calculate the next record ID whenever the selection changes
	const currentRecordId = getSelectedRecordId();

	// Update the next record ID whenever the selection or list changes
	const nextRecordId = useMemo(() => {
		if (!currentRecordId) return undefined;

		const currentIndex = recordsList.findIndex((record) => record.id === currentRecordId);
		if (currentIndex === -1) return undefined;

		const nextIndex = currentIndex + 1 < recordsList.length ? currentIndex + 1 : 0;
		return recordsList[nextIndex]?.id;
	}, [currentRecordId, recordsList]);

	// When no record is selected, show the full queue with filters
	if (!isRecordSelected) {
		return (
			<main className="flex basis-full flex-col overflow-hidden p-3">
				<RecordsGrid />
			</main>
		);
	}

	// When a record is selected, show the sidebar with the record list and the outlet
	return (
		<NextRecordIdContext.Provider value={nextRecordId}>
			<main className="flex basis-full overflow-hidden">
				<div className="flex shrink-0 grow-0 basis-72 flex-col gap-2 overflow-hidden border-r border-border py-3">
					<header className="flex items-center justify-between px-3">
						<h2 className="text-lg font-medium">
							Records <span className="text-sm text-c-secondary">({recordsList.length})</span>
						</h2>
						<Link to="/records" search={true} className="text-sm">
							Index
						</Link>
					</header>
					<ol className="flex flex-col gap-1 overflow-y-auto px-3 text-sm">
						{recordsList.map((record) => (
							<li
								key={record.id}
								className="flex shrink-0 selectable items-center gap-2 overflow-hidden rounded-sm border border-border bg-card px-2 py-1"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									navigate({
										to: '/records/$recordId',
										params: { recordId: record.id.toString() },
										search,
									});
								}}
							>
								<RecordLink
									record={record}
									className="flex-1 overflow-hidden text-xs"
									options={{ showExternalLink: false }}
								/>
							</li>
						))}
					</ol>
				</div>
				<Outlet />
			</main>
		</NextRecordIdContext.Provider>
	);
}
