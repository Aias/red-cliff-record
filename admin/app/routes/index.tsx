import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading } from '@radix-ui/themes';
import { Link } from '../components/Link';

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
					<Link to={`/history/$date`} params={{ date: new Date().toLocaleDateString('en-CA') }}>
						Daily History
					</Link>
					<Link to="/omit-list">Omit List</Link>
					<Link to="/commits">Commits</Link>
				</div>
			</Card>
		</Container>
	);
}
