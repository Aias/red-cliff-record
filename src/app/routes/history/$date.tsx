import { useMemo } from 'react';
import { Button, Dialog } from '@radix-ui/themes';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { OmitList } from './-OmitList';
import { DataGrid, NextIcon, PreviousIcon } from '~/components';
import { formatISODate, formatNumber, formatTime } from '~/lib/formatting';

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
					<span className="text-nowrap">
						{row.original.hostname.replaceAll('.local', '').replaceAll('-', ' ')}
					</span>
				),
			},
			{
				accessorKey: 'url',
				header: 'URL',
				cell: ({ row }) => (
					<a href={row.original.url.href} target="_blank" rel="noopener noreferrer">
						{`${row.original.url.hostname}${row.original.url.pathname}`}
					</a>
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
				<h1 className="min-w-200px">
					{localDate.toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
				</h1>
				<nav className="flex gap-2">
					<Button variant="soft" asChild className="text-nowrap whitespace-nowrap">
						<Link to="/history/$date" params={{ date: formatISODate(prevDate) }}>
							<PreviousIcon />
							Previous Day
						</Link>
					</Button>
					<Button variant="soft" asChild className="text-nowrap whitespace-nowrap">
						<Link to="/history/$date" params={{ date: formatISODate(nextDate) }}>
							Next Day
							<NextIcon />
						</Link>
					</Button>
				</nav>
			</header>

			<div role="toolbar" className="mb-4 flex items-center gap-4">
				<h2>Browser History</h2>
				<Dialog.Root>
					<Dialog.Trigger>
						<Button variant="outline">Modify Omit List</Button>
					</Dialog.Trigger>
					<Dialog.Content
						width="75dvw"
						maxWidth="75dvw"
						height="75dvh"
						maxHeight="75dvh"
						className="flex flex-col gap-4"
					>
						<header>
							<Dialog.Title>Omit List</Dialog.Title>
							<Dialog.Description>
								URLs matching patterns in this list will not be publicly visible or indexed.
							</Dialog.Description>
						</header>
						<OmitList className="grow overflow-hidden" />
					</Dialog.Content>
				</Dialog.Root>
			</div>
			<div className="h-full overflow-auto">
				<DataGrid
					data={history}
					columns={columns}
					sorting={true}
					getRowId={(row) => `${row.hostname}-${row.url.href}-${row.firstVisit}`}
				/>
			</div>
		</main>
	);
}
