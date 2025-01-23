import { createFileRoute, Outlet } from '@tanstack/react-router';
import { z } from 'zod';

const SearchSchema = z.object({
	itemId: z.string().optional(),
});

export const Route = createFileRoute('/queue')({
	validateSearch: SearchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
