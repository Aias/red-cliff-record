import { useMemo } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import type { FullRecord } from '@/server/api/routers/records.types';
import { RecordLink } from './record-link';

interface RelationsListProps {
	record: FullRecord;
}

export const RelationsList = ({
	record: { outgoingLinks, incomingLinks, ...rest },
}: RelationsListProps) => {
	const totalLinks = useMemo(
		() => outgoingLinks.length + incomingLinks.length,
		[outgoingLinks, incomingLinks]
	);

	return (
		<section>
			<h3 className="mb-2">
				Relations <span className="text-sm text-c-secondary">({totalLinks})</span>
			</h3>
			{totalLinks > 0 ? (
				<ul className="flex flex-col gap-2 text-xs">
					{outgoingLinks.map((link) => (
						<li key={link.id} className="flex items-center gap-2">
							<span className="flex w-22 shrink-0 items-center gap-1 truncate text-xs text-c-secondary capitalize">
								<ArrowRightIcon className="text-c-hint" />
								<span className="truncate">{link.predicate.name}</span>
							</span>
							<RecordLink
								toRecord={link.target}
								linkOptions={{
									to: '/records/$recordId',
									search: true,
									params: { recordId: link.target.id.toString() },
								}}
							/>
						</li>
					))}
					{incomingLinks.map((link) => (
						<li key={link.id} className="flex items-center gap-2">
							<span className="flex w-22 shrink-0 items-center gap-1 truncate text-xs text-c-secondary capitalize">
								<ArrowLeftIcon className="text-c-hint" />
								<span className="truncate">{link.predicate.name}</span>
							</span>
							<RecordLink
								toRecord={link.source}
								linkOptions={{
									to: '/records/$recordId',
									search: true,
									params: { recordId: link.source.id.toString() },
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
