import { createPgConnection as createConnection } from '@/db/connections';
import {
	arcBrowsingHistoryDaily,
	arcBrowsingHistoryOmitList,
} from '@/db/schema/integrations/schema';
import { sql } from 'drizzle-orm';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Heading, Table, Text, Link as RadixLink, Button, ScrollArea } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: date }) => {
		const db = createConnection();
		const tzOffset = new Date().getTimezoneOffset();
		// Invert the sign of the offset
		const adjustedOffset = -tzOffset;

		const history = await db
			.select()
			.from(arcBrowsingHistoryDaily)
			.where(
				sql`DATE(${arcBrowsingHistoryDaily.firstVisit} + INTERVAL ${sql.raw(`'${adjustedOffset} MINUTES'`)}) = to_date(${date}, 'YYYY-MM-DD') AND NOT EXISTS (
					SELECT 1 FROM ${arcBrowsingHistoryOmitList}
					WHERE ${arcBrowsingHistoryDaily.url} LIKE CONCAT('%', ${arcBrowsingHistoryOmitList.pattern}, '%')
				)`
			)
			.orderBy(arcBrowsingHistoryDaily.firstVisit);

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
				<Table.Root variant="surface">
					<Table.Header>
						<Table.Row>
							<Table.ColumnHeaderCell>Source</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Page Title</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell align="right">Duration</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell align="right">Visits</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>First Visit</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Last Visit</Table.ColumnHeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{history.map(
							({ hostname, pageTitle, totalDuration, url, visitCount, firstVisit, lastVisit }) => (
								<Table.Row key={`${hostname}-${url.href}-${pageTitle}`}>
									<Table.Cell>
										<Text wrap="nowrap">
											{hostname.replaceAll('.local', '').replaceAll('-', ' ')}
										</Text>
									</Table.Cell>
									<Table.Cell maxWidth="320px">
										<RadixLink href={url.href} target="_blank" rel="noopener noreferrer">
											{`${url.hostname}${url.pathname}`}
										</RadixLink>
									</Table.Cell>
									<Table.Cell>{pageTitle}</Table.Cell>
									<Table.Cell align="right">{formatNumber(totalDuration)}</Table.Cell>
									<Table.Cell align="right">{formatNumber(visitCount)}</Table.Cell>
									<Table.Cell minWidth="100px">{formatTime(firstVisit)}</Table.Cell>
									<Table.Cell minWidth="100px">{formatTime(lastVisit)}</Table.Cell>
								</Table.Row>
							)
						)}
					</Table.Body>
				</Table.Root>
			</ScrollArea>
		</main>
	);
}
