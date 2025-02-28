import { useEffect, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '../../trpc';
import { DuplicatesList } from './-components/duplicates-list';
import { RecordForm } from './-components/form';

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions(Number(recordId)));
	},
});

function RouteComponent() {
	const { recordId } = Route.useParams();
	const recordIdNumber = useMemo(() => Number(recordId), [recordId]);
	const [record] = trpc.records.get.useSuspenseQuery(recordIdNumber);

	useEffect(() => {
		console.log('record', record);
	}, [record]);

	return (
		<div className="flex basis-full gap-4 overflow-hidden p-4">
			<div className="card w-[540px] overflow-y-auto">
				<RecordForm recordId={recordIdNumber} />
			</div>
			<div className="flex-1">
				<DuplicatesList recordId={recordIdNumber} />
			</div>
		</div>
	);
}
