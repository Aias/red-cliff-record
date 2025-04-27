import { useContext, useEffect, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { RecordForm } from './-components/form';
import { NextRecordIdContext } from './route';
import { useRecordSuspense } from '@/lib/hooks/use-records';

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
	const { recordId } = Route.useParams();
	const record = useRecordSuspense(Number(recordId));
	const recordIdNumber = useMemo(() => Number(recordId), [recordId]);
	const nextRecordId = useContext(NextRecordIdContext);

	useEffect(() => {
		console.log('New record loaded:', record);
	}, [record]);

	return (
		<div className="flex basis-full gap-4 overflow-hidden p-4">
			<div className="card w-[540px] overflow-y-auto">
				<RecordForm recordId={recordIdNumber} nextRecordId={nextRecordId} />
			</div>
			{/* <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
				<RelationsList record={record} />
				<SimilarRecords record={record} />
			</div> */}
		</div>
	);
}
