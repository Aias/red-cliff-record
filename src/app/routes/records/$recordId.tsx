import { useContext, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { RecordForm } from './-components/form';
import { RelationsList, SimilarRecords } from './-components/relations';
import { NextRecordIdContext } from './route';

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions({ id: Number(recordId) }));
	},
	search: {
		middlewares: [retainSearchParams(true)],
	},
});

function RouteComponent() {
	const { recordId: recordIdParam } = Route.useParams();
	const recordId = useMemo(() => Number(recordIdParam), [recordIdParam]);
	const nextRecordId = useContext(NextRecordIdContext);

	return (
		<div className="flex flex-1 gap-4 overflow-x-auto p-4">
			<div className="card max-w-160 min-w-100 shrink basis-1/2 overflow-y-auto">
				<RecordForm recordId={recordId} nextRecordId={nextRecordId} />
			</div>
			<div className="flex max-w-160 min-w-100 flex-1 flex-col gap-4 overflow-y-auto">
				<RelationsList id={recordId} />
				<SimilarRecords id={recordId} />
			</div>
		</div>
	);
}
