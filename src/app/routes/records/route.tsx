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
import { RadioCards, RadioCardsItem } from '@/components/radio-cards';

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
		// If the list is empty, there's no next record
		if (recordsList.length === 0) return undefined;

		// If no record is currently selected, there's no concept of 'next'
		if (!currentRecordId) return undefined;

		const currentIndex = recordsList.findIndex((record) => record.id === currentRecordId);

		// If the current record isn't in the list, default to the first record in the list
		if (currentIndex === -1) {
			return recordsList[0]?.id;
		}

		// Otherwise, find the next record, wrapping around to the beginning if necessary
		const nextIndex = currentIndex + 1 < recordsList.length ? currentIndex + 1 : 0;
		return recordsList[nextIndex]?.id;
	}, [currentRecordId, recordsList]);

	const linkOptions = useMemo(() => ({ showExternalLink: false, showInternalLink: false }), []);

	const handleValueChange = useCallback(
		(value: string) => {
			navigate({
				to: '/records/$recordId',
				params: { recordId: value },
				search,
			});
		},
		[navigate, search]
	);

	const recordList = useMemo(
		() => (
			<RadioCards
				size="xs"
				value={currentRecordId?.toString()}
				onValueChange={handleValueChange}
				className="flex flex-col gap-1 overflow-y-auto px-3"
			>
				{recordsList.map((record) => (
					<RadioCardsItem key={record.id} value={record.id.toString()}>
						<RecordLink record={record} className="w-full overflow-hidden" options={linkOptions} />
					</RadioCardsItem>
				))}
			</RadioCards>
		),
		[recordsList, currentRecordId, handleValueChange, linkOptions]
	);

	return (
		<NextRecordIdContext.Provider value={nextRecordId}>
			<main className={`flex basis-full overflow-hidden ${!isRecordSelected ? 'p-3' : ''}`}>
				{isRecordSelected ? (
					<>
						<div className="flex shrink-0 grow-0 basis-72 flex-col gap-2 overflow-hidden border-r border-border py-3">
							<header className="flex items-center justify-between px-3">
								<h2 className="text-lg font-medium">
									Records <span className="text-sm text-c-secondary">({recordsList.length})</span>
								</h2>
								<Link to="/records" search={true} className="text-sm">
									Index
								</Link>
							</header>
							{recordList}
						</div>
						<Outlet />
					</>
				) : (
					<RecordsGrid />
				)}
			</main>
		</NextRecordIdContext.Provider>
	);
}
