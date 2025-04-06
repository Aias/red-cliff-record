import { useContext, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { DuplicatesList } from './-components/duplicates-list';
import { RecordForm } from './-components/form';
import { RelationsList } from './-components/relations';
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
	const recordIdNumber = useMemo(() => Number(recordId), [recordId]);
	const nextRecordId = useContext(NextRecordIdContext);

	return (
		<div className="flex basis-full gap-4 overflow-hidden p-4">
			<div className="card w-[540px] overflow-y-auto">
				<RecordForm recordId={recordIdNumber} nextRecordId={nextRecordId} />
			</div>
			<div className="flex-1 overflow-y-auto">
				<DuplicatesList recordId={recordIdNumber} />
				<RelationsList recordId={recordIdNumber} />
			</div>
		</div>
	);
}
