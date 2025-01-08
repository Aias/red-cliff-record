import { db } from '@/db/connections';
import { arcBrowsingHistory, arcBrowsingHistoryOmitList } from '@schema/integrations';
import { sql } from 'drizzle-orm';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Heading, Text, Link as RadixLink, Button, ScrollArea } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { z } from 'zod';
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataGrid } from '@/app/components/DataGrid';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
	.handler(async ({ data: date }) => {
		const tzOffset = new Date().getTimezoneOffset();
		const adjustedOffset = -tzOffset;

		const history = await db
			.select({
				hostname: arcBrowsingHistory.hostname,
				url: arcBrowsingHistory.url,
				pageTitle: arcBrowsingHistory.pageTitle,
				totalDuration: sql<number>`sum(${arcBrowsingHistory.viewDuration})`,
				visitCount: sql<number>`count(*)`,
				firstVisit: sql<string>`min(${arcBrowsingHistory.viewTime})`,
				lastVisit: sql<string>`max(${arcBrowsingHistory.viewTime})`,
			})
			.from(arcBrowsingHistory)
			.where(
				sql`DATE(${arcBrowsingHistory.viewTime} + INTERVAL ${sql.raw(`'${adjustedOffset} MINUTES'`)}) = to_date(${date}, 'YYYY-MM-DD') AND NOT EXISTS (
					SELECT 1 FROM ${arcBrowsingHistoryOmitList}
					WHERE ${arcBrowsingHistory.url} LIKE ${arcBrowsingHistoryOmitList.pattern}
				)`
			)
			.groupBy(arcBrowsingHistory.hostname, arcBrowsingHistory.url, arcBrowsingHistory.pageTitle)
			.orderBy(sql`min(${arcBrowsingHistory.viewTime})`);

		return history;
	});

export const Route = createFileRoute('/history/$date')({
	loader: ({ params: { date } }) => fetchHistoryForDate({ data: date }),
	component: DailyActivityPage,
});

const formatNumber = (num: number) => new Intl.NumberFormat().format(Math.round(num));
const formatTime = (date: Date | string) =>
	new Date(date).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	});

function DailyActivityPage() {
	const response = Route.useLoaderData();
	const { date } = Route.useParams();
	const history = response.map((entry) => ({
		...entry,
		url: new URL(entry.url),
	}));

	const localDate = new Date(`${date}T00:00`);
	const prevDate = new Date(localDate);
	prevDate.setDate(prevDate.getDate() - 1);
	const nextDate = new Date(localDate);
	nextDate.setDate(nextDate.getDate() + 1);

	const formatDateParam = (date: Date) => date.toISOString().split('T')[0];

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
		<main className="p-3 h-full flex flex-col">
			<header className="flex justify-between flex-wrap items-center mb-4 gap-4">
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
						<Link to="/history/$date" params={{ date: formatDateParam(prevDate) }}>
							<ChevronLeftIcon />
							Previous Day
						</Link>
					</Button>
					<Button variant="soft" asChild className="text-nowrap whitespace-nowrap">
						<Link to="/history/$date" params={{ date: formatDateParam(nextDate) }}>
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
