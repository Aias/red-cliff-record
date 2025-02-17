import { Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import { RecordEntryForm } from './-forms/RecordEntryForm';
import { Placeholder, Spinner } from '~/components';

export const Route = createFileRoute('/queue/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions(Number(params.recordId)));
	},
});

function RouteComponent() {
	return (
		<Suspense
			fallback={
				<Placeholder>
					<Spinner />
				</Placeholder>
			}
		>
			<RecordContent />
		</Suspense>
	);
}

function RecordContent() {
	const { recordId } = Route.useParams();
	const { data: record } = trpc.records.get.useQuery(Number(recordId));
	const utils = trpc.useUtils();

	return (
		<div className="flex basis-full flex-col gap-3 overflow-auto p-3">
			<div className="flex items-center gap-2">
				<h2>{record?.title}</h2>
			</div>
			<div className="card shrink-0">
				<RecordEntryForm
					recordId={recordId}
					defaults={record}
					updateCallback={async () => {
						utils.records.getQueue.invalidate();
						utils.records.getQueueCount.invalidate();
					}}
				/>
			</div>
		</div>
	);
}
