import { createConnection, browsingHistoryDaily } from '@rcr/database';
import { eq, sql } from 'drizzle-orm';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/start';
import { Container, Heading, Table, Link as RadixLink } from '@radix-ui/themes';

const fetchHistoryForDate = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: date }) => {
		const db = createConnection();
		const history = await db
			.select()
			.from(browsingHistoryDaily)
			.where(eq(sql`DATE(${browsingHistoryDaily.date})`, date))
			.orderBy(browsingHistoryDaily.url);

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
		durationMinutes: entry.totalDuration / 60,
		url: new URL(entry.url),
	}));

	return (
		<Container p="4">
			<Heading size="7" mb="4" as="h1">
				{new Date(date).toLocaleDateString('en-US', {
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
						<Table.ColumnHeaderCell>URL</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Page Title</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell align="right">Time on Page (mins)</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell align="right">Visit Count</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>First Visit</Table.ColumnHeaderCell>
						<Table.ColumnHeaderCell>Last Visit</Table.ColumnHeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{history.map(({ pageTitle, durationMinutes, url, visitCount, firstVisit, lastVisit }) => (
						<Table.Row key={`${url.href}-${pageTitle}`}>
							<Table.Cell maxWidth="400px">
								<RadixLink asChild>
									<a href={url.href} target="_blank" rel="noopener noreferrer">
										{`${url.hostname}${url.pathname}`}
									</a>
								</RadixLink>
							</Table.Cell>
							<Table.Cell>{pageTitle}</Table.Cell>
							<Table.Cell align="right">{Math.round(durationMinutes / 60)}</Table.Cell>
							<Table.Cell align="right">{visitCount}</Table.Cell>
							<Table.Cell>{new Date(firstVisit).toLocaleTimeString()}</Table.Cell>
							<Table.Cell>{new Date(lastVisit).toLocaleTimeString()}</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
		</Container>
	);
}
