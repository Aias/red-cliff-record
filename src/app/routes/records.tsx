import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';

const defaultQueryOptions = {
	filters: {
		needsCuration: true,
		isIndexNode: true,
	},
	limit: 200,
};

export const Route = createFileRoute('/records')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient } }) => {
		await queryClient.ensureQueryData(trpc.records.list.queryOptions(defaultQueryOptions));
	},
});

function RouteComponent() {
	const navigate = Route.useNavigate();
	const [recordsList] = trpc.records.list.useSuspenseQuery(defaultQueryOptions);

	return (
		<main className="flex basis-full overflow-hidden">
			<div className="flex w-80 flex-col gap-2 overflow-hidden border-r border-border bg-card py-3">
				<h2 className="px-4">Records Queue</h2>
				<ol className="flex flex-col overflow-y-auto">
					{recordsList.map((record) => {
						const { id, title, type } = record;
						return (
							<li
								key={id}
								className="flex selectable items-center gap-2 px-4 py-1"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									navigate({ to: '/records/$recordId', params: { recordId: id.toString() } });
								}}
							>
								<Link
									to="/records/$recordId"
									params={{ recordId: id.toString() }}
									className="flex-1"
								>
									{title ?? 'Untitled Record'}
								</Link>
								<span className="text-rcr-secondary capitalize">{type}</span>
							</li>
						);
					})}
				</ol>
			</div>
			<Outlet />
		</main>
	);
}
