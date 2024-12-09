import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading, Table } from '@radix-ui/themes';
import { createServerFn } from '@tanstack/start';
import { createConnection } from '@rcr/database';
import { githubCommits } from '@rcr/database/schema/integrations/github/schema';
import { desc } from 'drizzle-orm';
import { Link } from '../components/Link';

const fetchCommits = createServerFn({ method: 'GET' }).handler(async () => {
	const db = createConnection();
	const commits = await db.query.githubCommits.findMany({
		with: {
			repository: true,
		},
		orderBy: [desc(githubCommits.committedAt)],
		limit: 50,
	});
	return { commits };
});

export const Route = createFileRoute('/commits')({
	loader: () => fetchCommits(),
	component: CommitList,
});

function CommitList() {
	const { commits } = Route.useLoaderData();

	return (
		<Container size="3" p="4">
			<Card>
				<Heading size="6" mb="4">
					Recent Commits
				</Heading>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.ColumnHeaderCell>SHA</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Repository</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{commits.map((commit) => (
							<Table.Row key={commit.sha}>
								<Table.Cell>
									<Link to={`/commits/$sha`} params={{ sha: commit.sha }}>
										{commit.sha.slice(0, 7)}
									</Link>
								</Table.Cell>
								<Table.Cell>{commit.repository.name}</Table.Cell>
								<Table.Cell>{commit.message}</Table.Cell>
								<Table.Cell>
									{commit.committedAt ? new Date(commit.committedAt).toLocaleDateString() : ''}
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table.Root>
			</Card>
		</Container>
	);
}
