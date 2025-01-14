import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '../trpc';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return <div>Home</div>;
}
