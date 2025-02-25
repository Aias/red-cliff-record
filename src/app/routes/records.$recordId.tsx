import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '../trpc';
import { Avatar, DynamicTextarea, GhostInput, Input } from '@/components';

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions(Number(recordId)));
	},
});

function RouteComponent() {
	const { recordId } = Route.useParams();
	const [record] = trpc.records.get.useSuspenseQuery(Number(recordId));

	const { avatarUrl, title, content, summary, notes, type, children, parent } = useMemo(
		() => record,
		[record]
	);

	return (
		<div className="flex size-full flex-col overflow-hidden p-4">
			<div className="card flex flex-col gap-2">
				<h1 className="flex items-center gap-2">
					{avatarUrl && <Avatar inline src={avatarUrl} fallback={title?.charCodeAt(0) ?? '?'} />}
					<GhostInput value={title ?? ''} placeholder="Untitled Record" />
				</h1>
				<DynamicTextarea value={summary ?? ''} placeholder="Summary" />
				<DynamicTextarea value={content ?? ''} placeholder="Content" />
				<DynamicTextarea value={notes ?? ''} placeholder="Notes" />
			</div>
		</div>
	);
}
