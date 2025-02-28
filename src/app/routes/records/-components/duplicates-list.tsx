import { Link, useNavigate } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { Placeholder, Spinner } from '@/components';

interface DuplicatesListProps {
	recordId: number;
}

export const DuplicatesList = ({ recordId }: DuplicatesListProps) => {
	const navigate = useNavigate();
	const utils = trpc.useUtils();
	const { data: duplicates, isLoading } = trpc.records.findDuplicates.useQuery(recordId, {
		enabled: !!recordId,
	});

	const handleMerge = trpc.records.merge.useMutation({
		onSuccess: (data) => {
			navigate({ to: '/records/$recordId', params: { recordId: data.target.id.toString() } });
			utils.records.findDuplicates.invalidate();
			utils.records.get.invalidate();
			utils.records.list.invalidate();
		},
	});

	const onMergeClick = (targetId: number) => {
		if (!recordId) return;

		if (
			confirm(
				`Are you sure you want to merge this record into record #${targetId}? This action cannot be undone.`
			)
		) {
			handleMerge.mutate({
				sourceId: recordId,
				targetId: targetId,
			});
		}
	};

	// Check if a specific merge is in progress
	const isMerging = (targetId: number): boolean => {
		return (
			handleMerge.status === 'pending' &&
			handleMerge.variables?.sourceId === recordId &&
			handleMerge.variables?.targetId === targetId
		);
	};

	return duplicates && duplicates.length > 0 ? (
		<div className="flex flex-col gap-4">
			<div className="text-lg font-bold">Potential Duplicates</div>
			<div className="flex flex-col gap-3">
				{duplicates.map((record) => {
					const { id, title, summary, similarityScore, type, creators, recordUpdatedAt } = record;

					// Safely format the date without date-fns
					const formattedDate = recordUpdatedAt
						? new Date(recordUpdatedAt).toLocaleDateString()
						: '';

					return (
						<div key={id} className="rounded-md border p-4">
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<h3 className="text-base font-semibold">
											<Link to="/records/$recordId" params={{ recordId: id.toString() }}>
												{title || 'Untitled'}
											</Link>
										</h3>
										<span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{type}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											{formattedDate && `Updated ${formattedDate}`}
										</span>
										<span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs">
											ID: {id}
										</span>
									</div>
								</div>
								<div className="mt-1">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">Similarity:</span>
										<div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
											<div
												className="h-full bg-blue-500"
												style={{ width: `${similarityScore}%` }}
											></div>
										</div>
										<span className="text-sm font-medium">{similarityScore}%</span>
									</div>
								</div>
								{summary && (
									<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{summary}</p>
								)}
								{creators && creators.length > 0 && (
									<div className="mt-2 flex flex-wrap gap-1">
										{creators.map((c) => (
											<span key={c.creatorId} className="rounded-full border px-2 py-1 text-xs">
												{/* Use a safe approach to display creator name */}
												Creator {c.creatorId}
											</span>
										))}
									</div>
								)}
								<div className="mt-3 flex justify-end">
									<button
										onClick={() => onMergeClick(id)}
										disabled={handleMerge.status === 'pending'}
										className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
									>
										{isMerging(id) ? 'Merging...' : 'Merge into this record'}
									</button>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	) : isLoading ? (
		<Placeholder>
			<Spinner />
			<p>Searching for duplicates...</p>
		</Placeholder>
	) : (
		<div className="py-2 text-muted-foreground">No potential duplicates found.</div>
	);
};
