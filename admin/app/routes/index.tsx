import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading, Link } from '@radix-ui/themes';

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
					<Link asChild>
						<a href={`/history/${new Date().toLocaleDateString('en-CA')}`}>Daily History</a>
					</Link>
					<Link asChild>
						<a href="/omit-list">Omit List</a>
					</Link>
				</div>
			</Card>
		</Container>
	);
}
