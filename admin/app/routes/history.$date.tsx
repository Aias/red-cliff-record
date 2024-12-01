import { createConnection, browsingHistoryDaily } from '@rcr/database';
import { eq, sql } from 'drizzle-orm';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Container, Heading, Table, Text, Link as RadixLink } from '@radix-ui/themes';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: date }) => {
		const db = createConnection();
		const history = await db
			.select()
			.from(browsingHistoryDaily)
			.where(eq(sql`DATE(${browsingHistoryDaily.date})`, date))
			.orderBy(browsingHistoryDaily.firstVisit);

		return { response: history };
	});

export const Route = createFileRoute('/history/$date')({
	loader: async ({ params: { date } }) => fetchHistoryForDate({ data: date }),
	component: DailyActivityPage,
});

function DailyActivityPage() {
	const { response } = Route.useLoaderData();
	const { date } = Route.useParams();
	const history = response.map((entry) => ({
		...entry,
		url: new URL(entry.url),
	}));

	const localDate = new Date(`${date}T00:00`);

	return (
		<Container p="4">
			<Heading size="7" mb="4" as="h1">
				{localDate.toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})}
			</Heading>
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
								<Table.Cell align="right">{Math.round(totalDuration)}</Table.Cell>
								<Table.Cell align="right">{visitCount}</Table.Cell>
								<Table.Cell minWidth="100px">
									{new Date(firstVisit).toLocaleTimeString()}
								</Table.Cell>
								<Table.Cell minWidth="100px">{new Date(lastVisit).toLocaleTimeString()}</Table.Cell>
							</Table.Row>
						)
					)}
				</Table.Body>
			</Table.Root>
		</Container>
	);
}
