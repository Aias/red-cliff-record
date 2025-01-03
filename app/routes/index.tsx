import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading } from '@radix-ui/themes';
import { AppLink } from '../components/AppLink';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return (
		<Container size="1" p="4" className="flex flex-col h-full">
			<Card className="max-w-sm mx-auto my-9">
				<Heading size="6" mb="4" align="center">
					Red Cliff Record Admin
				</Heading>
				<nav>
					<ul className="flex flex-col gap-2 list-none p-0">
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
					</ul>
				</nav>
			</Card>
		</Container>
	);
}
