import { createFileRoute, Link, Outlet, retainSearchParams } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { ListRecordsInputSchema } from '@/server/api/routers/records.types';
import { QueueFilters } from './-components/queue';
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	SettingsIcon,
} from '@/components';

export const Route = createFileRoute('/records')({
	validateSearch: ListRecordsInputSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context: { trpc, queryClient }, deps: { search } }) => {
		await queryClient.ensureQueryData(trpc.records.list.queryOptions(search));
	},
	component: RouteComponent,
	search: {
		middlewares: [retainSearchParams(true)],
	},
});

function RouteComponent() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const [recordsList] = trpc.records.list.useSuspenseQuery(search);

	return (
		<main className="flex basis-full overflow-hidden">
			<div className="flex shrink-0 grow-0 basis-72 flex-col gap-2 overflow-hidden border-r border-border py-3">
				<header className="flex items-center justify-between px-3">
					<h2 className="text-lg font-medium">Records Queue</h2>
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="ghost" title="Manage Queue">
								<SettingsIcon />
							</Button>
						</DialogTrigger>
						<DialogContent className="flex h-[95vh] w-[95vw] flex-col">
							<DialogHeader>
								<DialogTitle>Manage Queue</DialogTitle>
								<DialogDescription>Manage the records in the queue.</DialogDescription>
							</DialogHeader>
							<QueueFilters />
						</DialogContent>
					</Dialog>
				</header>
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
									navigate({
										to: '/records/$recordId',
										params: { recordId: id.toString() },
										search,
									});
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
