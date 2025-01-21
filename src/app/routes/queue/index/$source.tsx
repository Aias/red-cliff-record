import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/queue/index/$source')({
	component: RouteComponent,
});

function RouteComponent() {
	const { source } = Route.useParams();
	return <div>Coming from {source}</div>;
}
