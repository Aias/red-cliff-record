import { useContext, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { RecordForm } from './-components/form';
import { RelationsList, SimilarRecords } from './-components/relations';
import { NextRecordIdContext } from './route';

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions(Number(recordId)));
	},
	search: {
		middlewares: [retainSearchParams(true)],
	},
});

function RouteComponent() {
	const { recordId } = Route.useParams();
	const [record] = trpc.records.get.useSuspenseQuery(Number(recordId));
	const recordIdNumber = useMemo(() => Number(recordId), [recordId]);
	const nextRecordId = useContext(NextRecordIdContext);

	return (
		<div className="flex basis-full gap-4 overflow-hidden p-4">
			<div className="card w-[540px] overflow-y-auto">
				<RecordForm recordId={recordIdNumber} nextRecordId={nextRecordId} />
			</div>
			<div className="flex flex-1 flex-col gap-4 overflow-y-auto">
				<RelationsList record={record} />
				<SimilarRecords record={record} />
			</div>
		</div>
	);
}
