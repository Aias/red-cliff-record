import { useCallback, useEffect, useMemo } from 'react';
import { PlusIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import type { FullRecord, RecordWithoutEmbedding } from '@/server/api/routers/records.types';
import { RecordLink } from './record-link';
import { RelationshipSelector } from './record-lookup';
import type { LinkSelect, PredicateSelect } from '@/db/schema';

interface RelationsListProps {
	record: FullRecord;
}

interface RecordLink extends LinkSelect {
	predicate: PredicateSelect;
	record: RecordWithoutEmbedding;
	direction: 'outgoing' | 'incoming';
}

export const RelationsList = ({
	record: { outgoingLinks, incomingLinks, id },
}: RelationsListProps) => {
	const utils = trpc.useUtils();
	const totalLinks = useMemo(
		() => outgoingLinks.length + incomingLinks.length,
		[outgoingLinks, incomingLinks]
	);
	const { data: predicates } = trpc.relations.listPredicates.useQuery();

	const upsertMutation = trpc.relations.upsert.useMutation({
		onSuccess: () => {
			utils.records.invalidate();
		},
	});

	const _getInversePredicate = useCallback(
		(predicate: PredicateSelect): PredicateSelect => {
			return predicates?.find((p) => p.inverseSlug === predicate.slug) || predicate;
		},
		[predicates]
	);

	const allLinks: RecordLink[] = useMemo(() => {
		return [
			...outgoingLinks.map((link) => ({
				...link,
				record: link.target,
				direction: 'outgoing' as const,
			})),
			...incomingLinks.map((link) => ({
				...link,
				record: link.source,
				direction: 'incoming' as const,
			})),
		];
	}, [outgoingLinks, incomingLinks]);

	useEffect(() => {
		console.log('allLinks', allLinks);
	}, [allLinks]);

	return (
		<section>
			<header className="flex items-center justify-between overflow-hidden">
				<h3 className="mb-2">
					Relations <span className="text-sm text-c-secondary">({totalLinks})</span>
				</h3>
				<RelationshipSelector
					sourceId={id}
					label={
						<span>
							<PlusIcon /> Add
						</span>
					}
					buttonProps={{ size: 'sm', variant: 'outline', className: 'h-[1.5lh]' }}
					onComplete={(sourceId, targetId, predicateId) => {
						console.log('new relationship', sourceId, targetId, predicateId);
					}}
					popoverProps={{ side: 'left' }}
				/>
			</header>
			{totalLinks > 0 ? (
				<ul className="flex flex-col gap-2 text-xs">
					{allLinks.map((link) => (
						<li key={link.id} className="flex items-center gap-2">
							<RelationshipSelector
								sourceId={link.sourceId}
								link={link}
								onComplete={(sourceId, targetId, predicateId) => {
									console.log('onComplete', sourceId, targetId, predicateId);
									upsertMutation.mutate({
										id: link.id,
										sourceId,
										targetId,
										predicateId,
									});
								}}
							/>
							<RecordLink
								toRecord={link.record}
								linkOptions={{
									to: '/records/$recordId',
									search: true,
									params: { recordId: link.record.id.toString() },
								}}
							/>
						</li>
					))}
				</ul>
			) : (
				<p className="py-2 text-c-secondary">No related records.</p>
			)}
		</section>
	);
};

export const SimilarRecords = ({ record }: { record: FullRecord }) => {
	const recordId = useMemo(() => record.id, [record.id]);

	const omittedRecordIds = useMemo(() => {
		const { incomingLinks, outgoingLinks } = record;
		return [
			record,
			...incomingLinks.map((link) => link.source),
			...outgoingLinks.map((link) => link.target),
		]
			.map((record) => record.id)
			.filter((id): id is number => id !== undefined);
	}, [record]);

	// Fetch similar records only if textEmbedding exists
	const { data: similarRecords, isLoading } = trpc.records.similaritySearch.useQuery(
		{
			vector: record.textEmbedding!, // Assert non-null because enabled is true only if it exists
			limit: 10,
			exclude: [recordId, ...omittedRecordIds],
		},
		{
			enabled: !!record.textEmbedding, // Only run the query if textEmbedding is present
		}
	);

	return record.textEmbedding ? (
		<section className="text-xs">
			<h3 className="mb-2">Similar Records</h3>
			{isLoading ? (
				<p>Loading...</p>
			) : similarRecords && similarRecords.length > 0 ? (
				<ul>
					{similarRecords.map((record) => (
						<li key={record.id} className="mb-2 flex items-center gap-4">
							<span className="w-[4ch] shrink-0 font-mono text-xs text-c-secondary">
								{record.similarity.toFixed(2)}
							</span>
							<RecordLink
								toRecord={record}
								className="flex-1"
								linkOptions={{
									to: '/records/$recordId',
									search: true,
									params: {
										recordId: record.id.toString(),
									},
								}}
							/>
						</li>
					))}
				</ul>
			) : (
				<p>No similar records found.</p>
			)}
		</section>
	) : null;
};
