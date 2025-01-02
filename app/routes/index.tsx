import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading } from '@radix-ui/themes';
import { AppLink } from '../components/AppLink';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return (
		<Container size="1" p="4">
			<Card style={{ maxWidth: '400px', margin: '48px auto' }}>
				<Heading size="6" mb="4" align="center">
					Red Cliff Record Admin
				</Heading>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<AppLink to={`/history/$date`} params={{ date: new Date().toLocaleDateString('en-CA') }}>
						Daily History
					</AppLink>
					<AppLink to="/omit-list">Omit List</AppLink>
					<AppLink to="/commits">Commits</AppLink>
				</div>
			</Card>
		</Container>
	);
}
