import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import type { ListRecordsInput } from '@/server/api/routers/records';

const defaultQueryOptions: ListRecordsInput = {
	filters: {
		isCurated: false,
		isIndexNode: true,
	},
	limit: 200,
	offset: 0,
	orderBy: [
		{
			field: 'recordCreatedAt',
			direction: 'desc',
		},
		{
			field: 'id',
			direction: 'desc',
		},
	],
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
			<div className="flex w-80 flex-col gap-2 overflow-hidden border-r border-border py-3">
				<h2 className="px-3">Records Queue</h2>
				<ol className="flex flex-col gap-2 overflow-y-auto px-3">
					{recordsList.map((record) => {
						const { id, title, type } = record;
						return (
							<li
								key={id}
								className="flex shrink-0 selectable items-center gap-2 overflow-hidden rounded-md border border-border bg-card p-2 text-sm"
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
