import { useMemo } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { trpc } from '@/app/trpc';
import type { FullRecord, RecordWithoutEmbedding } from '@/server/api/routers/records.types';
import { RecordLink } from './record-link';

interface RelationsListProps {
	record: FullRecord;
}

interface TimeSortable {
	contentCreatedAt: Date | null;
	contentUpdatedAt: Date | null;
	recordCreatedAt: Date;
	recordUpdatedAt: Date;
}

function sortByTime(a: TimeSortable, b: TimeSortable) {
	// Use contentCreatedAt if both records have it, otherwise fall back to recordCreatedAt
	if (a.contentCreatedAt && b.contentCreatedAt) {
		return a.contentCreatedAt.getTime() - b.contentCreatedAt.getTime();
	}
	return a.recordCreatedAt.getTime() - b.recordCreatedAt.getTime();
}

export const RelationsList = ({ record }: RelationsListProps) => {
	const { outgoingLinks, incomingLinks } = useMemo(
		() =>
			record ?? {
				outgoingLinks: [],
				incomingLinks: [],
			},
		[record]
	);

	const creators = outgoingLinks
		.filter((link) => link.predicate.type === 'creation')
		.map((link) => link.target);
	const created = incomingLinks
		.filter((link) => link.predicate.type === 'creation')
		.map((link) => link.source);
	const formats = outgoingLinks
		.filter((link) => link.predicate.type === 'identity')
		.map((link) => link.target);
	const formatOf = incomingLinks
		.filter((link) => link.predicate.type === 'identity')
		.map((link) => link.source);
	const parents = outgoingLinks
		.filter((link) => link.predicate.type === 'containment')
		.map((link) => link.target);
	const children = incomingLinks
		.filter((link) => link.predicate.type === 'containment')
		.map((link) => link.source);
	const references = outgoingLinks
		.filter((link) => link.predicate.type === 'association')
		.map((link) => link.target);
	const referencedBy = incomingLinks
		.filter((link) => link.predicate.type === 'association')
		.map((link) => link.source);
	const tags = outgoingLinks
		.filter((link) => link.predicate.type === 'description')
		.map((link) => link.target);
	const tagged = incomingLinks
		.filter((link) => link.predicate.type === 'description')
		.map((link) => link.source);

	const combinedReferences = useMemo(() => {
		if (!record) return [];

		const referencesMap = new Map<
			number,
			{ record: RecordWithoutEmbedding; direction: 'reference' | 'referencedBy' | 'both' }
		>();

		references.forEach((ref) => {
			referencesMap.set(ref.id, { record: ref, direction: 'reference' });
		});

		referencedBy.forEach((refBy) => {
			const existing = referencesMap.get(refBy.id);
			if (existing) {
				existing.direction = 'both';
			} else {
				referencesMap.set(refBy.id, { record: refBy, direction: 'referencedBy' });
			}
		});

		return Array.from(referencesMap.values());
	}, [record]);

	return record ? (
		<div className="text-xs">
			{formats.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Format</h3>
					<RelationList records={formats} />
				</section>
			)}
			{formatOf.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Format Of</h3>
					<RelationList records={formatOf} />
				</section>
			)}
			{creators.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Creators</h3>
					<RelationList records={creators} />
				</section>
			)}
			{created.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Created</h3>
					<RelationList records={created} />
				</section>
			)}
			{parents.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Parent</h3>
					<RelationList records={parents} />
				</section>
			)}
			{children.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Children</h3>
					<RelationList records={children.sort(sortByTime)} />
				</section>
			)}

			{tags.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Tags</h3>
					<RelationList records={tags} />
				</section>
			)}
			{tagged.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Tagged</h3>
					<RelationList records={tagged} />
				</section>
			)}
			{combinedReferences.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Relations</h3>
					<ul>
						{combinedReferences.map(({ record: refRecord, direction }) => (
							<li key={refRecord.id} className="mb-2">
								<ReferenceItem record={refRecord} direction={direction} />
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	) : (
		<div className="py-2 text-muted-foreground">No related records.</div>
	);
};

interface RelationListProps {
	records: RecordWithoutEmbedding[];
}

const RelationList = ({ records }: RelationListProps) => {
	return (
		<ul>
			{records.map((record) => (
				<li key={record.id} className="mb-2">
					<RecordLink
						toRecord={record}
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
	);
};

// New component for displaying combined references with directionality
interface ReferenceItemProps {
	record: RecordWithoutEmbedding;
	direction: 'reference' | 'referencedBy' | 'both';
}

const ReferenceItem = ({ record, direction }: ReferenceItemProps) => {
	const DirectionIcon = useMemo(() => {
		switch (direction) {
			case 'reference':
				return ArrowRight;
			case 'referencedBy':
				return ArrowLeft;
			case 'both':
				return ArrowLeftRight;
		}
	}, [direction]);

	return (
		<div className="flex items-center justify-between gap-4">
			<span className="w-[4ch] shrink-0 text-center font-mono text-xs text-c-accent">
				<DirectionIcon className="size-4 shrink-0" />
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
		</div>
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
		<section className="px-3 text-xs">
			<h3 className="mt-4 mb-2">Similar Records</h3>
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
