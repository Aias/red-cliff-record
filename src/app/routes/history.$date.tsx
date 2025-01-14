import { useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { Button, Heading, Link as RadixLink, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '~/app/components/DataGrid';
import { formatISODate, formatNumber, formatTime } from '~/app/lib/formatting';

export const Route = createFileRoute('/history/$date')({
	loader: ({ params: { date }, context: { queryClient, trpc } }) =>
		queryClient.ensureQueryData(trpc.history.getHistoryForDate.queryOptions(date)),
	component: DailyActivityPage,
});

function DailyActivityPage() {
	const response = Route.useLoaderData();
	const { date } = Route.useParams();
	const history = response.map((entry) => ({
		...entry,
		url: new URL(entry.url),
	}));

	const { localDate, prevDate, nextDate } = useMemo(() => {
		const localDate = new Date(`${date}T00:00`);
		const prevDate = new Date(localDate);
		prevDate.setDate(prevDate.getDate() - 1);
		const nextDate = new Date(localDate);
		nextDate.setDate(nextDate.getDate() + 1);
		return { localDate, prevDate, nextDate };
	}, [date]);

	const columns = useMemo<ColumnDef<(typeof history)[0]>[]>(
		() => [
			{
				accessorKey: 'hostname',
				header: 'Source',
				cell: ({ row }) => (
					<Text wrap="nowrap">
						{row.original.hostname.replaceAll('.local', '').replaceAll('-', ' ')}
					</Text>
				),
			},
			{
				accessorKey: 'url',
				header: 'URL',
				cell: ({ row }) => (
					<RadixLink href={row.original.url.href} target="_blank" rel="noopener noreferrer">
						{`${row.original.url.hostname}${row.original.url.pathname}`}
					</RadixLink>
				),
				meta: {
					columnProps: {
						maxWidth: '320px',
					},
				},
			},
			{
				accessorKey: 'pageTitle',
				header: 'Page Title',
			},
			{
				accessorKey: 'totalDuration',
				header: 'Duration',
				cell: ({ getValue }) => formatNumber(getValue() as number),
				meta: {
					columnProps: {
						align: 'right',
					},
				},
			},
			{
				accessorKey: 'visitCount',
				header: 'Visits',
				cell: ({ getValue }) => formatNumber(getValue() as number),
				meta: {
					columnProps: {
						align: 'right',
					},
				},
			},
			{
				accessorKey: 'firstVisit',
				header: 'First Visit',
				cell: ({ getValue }) => formatTime(getValue() as string),
				meta: {
					columnProps: {
						minWidth: '100px',
					},
				},
			},
			{
				accessorKey: 'lastVisit',
				header: 'Last Visit',
				cell: ({ getValue }) => formatTime(getValue() as string),
				meta: {
					columnProps: {
						minWidth: '100px',
					},
				},
			},
		],
		[]
	);

	return (
		<main className="flex basis-full flex-col overflow-hidden p-3">
			<header className="mb-4 flex flex-wrap items-center justify-between gap-4">
				<Heading size="7" as="h1" className="min-w-200px">
					{localDate.toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
				</Heading>
				<nav className="flex gap-2">
					<Button variant="soft" asChild className="text-nowrap whitespace-nowrap">
						<Link to="/history/$date" params={{ date: formatISODate(prevDate) }}>
							<ChevronLeftIcon />
							Previous Day
						</Link>
					</Button>
					<Button variant="soft" asChild className="text-nowrap whitespace-nowrap">
						<Link to="/history/$date" params={{ date: formatISODate(nextDate) }}>
							Next Day
							<ChevronRightIcon />
						</Link>
					</Button>
				</nav>
			</header>

			<Heading size="5" mb="4" as="h2">
				Browser History
			</Heading>
			<ScrollArea>
				<DataGrid
					data={history}
					columns={columns}
					sorting={true}
					getRowId={(row) => `${row.hostname}-${row.url.href}-${row.firstVisit}`}
				/>
			</ScrollArea>
		</main>
	);
}
