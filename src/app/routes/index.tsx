import { Card, Container, Heading } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { AppLink } from '../components/AppLink';
import { useTRPC } from '~/app/trpc';
import { useSuspenseQuery } from '@tanstack/react-query';

export const Route = createFileRoute('/')({
	component: Home,
	loader: async ({ context: { trpc } }) => {
		await trpc.test.hello.prefetch({
			text: 'world!',
		});
	},
});

function Home() {
	const trpc = useTRPC();
	const hello = useSuspenseQuery(
		trpc.test.hello.queryOptions({
			text: 'world!',
		})
	);

	return (
		<Container size="1" p="4" className="flex h-full flex-col">
			<Card className="mx-auto my-9 max-w-sm">
				<Heading size="6" mb="4" align="center">
					Red Cliff Record Admin {hello.data.greeting}
				</Heading>
				<nav>
					<ul className="flex list-none flex-col gap-2 p-0">
						<li>
							<AppLink
								to={`/history/$date`}
								params={{ date: new Date().toLocaleDateString('en-CA') }}
							>
								Daily History
							</AppLink>
						</li>
						<li>
							<AppLink to="/omit-list">Omit List</AppLink>
						</li>
						<li>
							<AppLink to="/commits">Commits</AppLink>
						</li>
						<li>
							<AppLink to="/queue/airtable">Index Queue</AppLink>
						</li>
					</ul>
				</nav>
			</Card>
		</Container>
	);
}
