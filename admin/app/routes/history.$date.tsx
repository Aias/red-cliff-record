import { createConnection, browsingHistoryDaily, browsingHistoryOmitList } from '@rcr/database';
import { eq, sql, not, exists } from 'drizzle-orm';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Container, Heading, Table, Text, Link as RadixLink, Button, Flex } from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: date }) => {
		const db = createConnection();
		const history = await db
			.select()
			.from(browsingHistoryDaily)
			.where(
				sql`DATE(${browsingHistoryDaily.date}) = ${date} AND NOT EXISTS (
					SELECT 1 FROM ${browsingHistoryOmitList}
					WHERE ${browsingHistoryDaily.url} LIKE CONCAT('%', ${browsingHistoryOmitList.pattern}, '%')
				)`
			)
			.orderBy(browsingHistoryDaily.firstVisit);

		return { response: history };
	});

export const Route = createFileRoute('/history/$date')({
	loader: async ({ params: { date } }) => fetchHistoryForDate({ data: date }),
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
	const { response } = Route.useLoaderData();
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
		<Container p="4">
			<Flex justify="between" align="center" mb="4">
				<Heading size="7" as="h1">
					{localDate.toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
				</Heading>
				<Flex gap="2">
					<Link to="/history/$date" params={{ date: formatDateParam(prevDate) }}>
						<Button variant="soft">
							<ChevronLeftIcon />
							Previous Day
						</Button>
					</Link>
					<Link to="/history/$date" params={{ date: formatDateParam(nextDate) }}>
						<Button variant="soft">
							Next Day
							<ChevronRightIcon />
						</Button>
					</Link>
				</Flex>
			</Flex>

			<Heading size="5" mb="4" as="h2">
				Browser History
			</Heading>
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
									<RadixLink asChild>
										<a href={url.href} target="_blank" rel="noopener noreferrer">
											{`${url.hostname}${url.pathname}`}
										</a>
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
		</Container>
	);
}
