import { Card, Container, Heading } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { AppLink } from '../components/AppLink';

export const Route = createFileRoute('/')({
	component: Home,
	loader: async ({ context: { trpc } }) => {
		const hello = await trpc.test.hello.query({
			text: 'world!',
		});
		return {
			hello,
		};
	},
});

function Home() {
	return (
		<Container size="1" p="4" className="flex h-full flex-col">
			<Card className="mx-auto my-9 max-w-sm">
				<Heading size="6" mb="4" align="center">
					Red Cliff Record Admin
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
