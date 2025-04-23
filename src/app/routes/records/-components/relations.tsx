import { memo, useMemo } from 'react';
import { Link, type LinkOptions } from '@tanstack/react-router';
import { ArrowLeft, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { trpc } from '@/app/trpc';
import type { FullRecord, RecordWithoutEmbedding } from '@/server/api/routers/records.types';
import { recordTypeIcons } from './type-icons';
import { IntegrationLogo } from '@/components';
import type { LinkSelect, MediaSelect, MediaType, PredicateSelect } from '@/db/schema';
import { cn } from '@/lib/utils';

interface RelationsListProps {
	record: FullRecord;
}

function sortByTime(a: RecordWithoutEmbedding, b: RecordWithoutEmbedding) {
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

interface RecordWithRelations extends RecordWithoutEmbedding {
	media?: MediaSelect[];
	outgoingLinks?: Array<
		LinkSelect & { predicate: PredicateSelect; target: RecordWithoutEmbedding }
	>;
	incomingLinks?: Array<
		LinkSelect & { predicate: PredicateSelect; source: RecordWithoutEmbedding }
	>;
}

interface RecordLinkProps {
	record: RecordWithRelations;
	className?: string;
	linkOptions?: LinkOptions;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

export const RecordLink = memo(
	({ record, className, linkOptions, checked, onCheckedChange }: RecordLinkProps) => {
		const {
			type,
			title,
			content,
			summary,
			notes,
			url,
			sources,
			media,
			mediaCaption,
			avatarUrl,
			recordUpdatedAt,
			outgoingLinks,
		} = record;

		const firstCreator = useMemo(
			() => outgoingLinks?.find((link) => link.predicate.type === 'creation')?.target,
			[outgoingLinks]
		);
		const parent = useMemo(
			() => outgoingLinks?.find((link) => link.predicate.type === 'containment')?.target,
			[outgoingLinks]
		);

		const TypeIcon = useMemo(() => recordTypeIcons[type].icon, [type]);
		const label = useMemo(() => {
			if (title) return title;
			if (firstCreator) return firstCreator.title;
			if (parent) return `↳ ${parent.title}`;
			return 'Untitled';
		}, [title, firstCreator, parent]);

		const mediaItem: {
			type: MediaType;
			altText?: string | null;
			url: string;
		} | null = useMemo(() => {
			if (media && media.length > 0 && media[0]) {
				return media[0];
			}
			if (avatarUrl) {
				return {
					type: 'image',
					url: avatarUrl,
				};
			}
			return null;
		}, [media, avatarUrl]);

		const preview = useMemo(() => {
			return (
				summary || content || notes || url || `Updated ${recordUpdatedAt.toLocaleDateString()}`
			);
		}, [summary, content, notes, url, recordUpdatedAt]);

		return (
			<div className="flex grow items-start gap-3">
				<div className="flex grow flex-col gap-[0.25em]">
					<div className={cn('flex items-center gap-1', className)}>
						<TypeIcon className="text-c-symbol" />
						<div className="flex grow items-center gap-1">
							{linkOptions ? (
								<Link className="mr-auto line-clamp-1" {...linkOptions}>
									{label}
								</Link>
							) : (
								<strong className="mr-auto line-clamp-1">{label}</strong>
							)}
						</div>
						<ul className="flex items-center gap-1.5 text-[0.75em] opacity-50">
							{sources?.map((source) => (
								<li key={source}>
									<IntegrationLogo integration={source} />
								</li>
							))}
						</ul>
					</div>
					<p className="line-clamp-1 text-[0.925em] break-all text-c-secondary">{preview}</p>
				</div>
				{mediaItem && (
					<div className="relative aspect-[3/2] h-[2lh] w-auto shrink-0 grow-0 basis-auto self-center overflow-hidden rounded-md border border-c-divider bg-c-mist">
						{mediaItem.type === 'image' ? (
							<img
								src={mediaItem.url}
								alt={mediaItem.altText ?? mediaCaption ?? ''}
								className="absolute inset-0 object-cover"
							/>
						) : (
							<video src={mediaItem.url} className="absolute inset-0 object-cover" />
						)}
					</div>
				)}
			</div>
		);
	}
);

interface RelationListProps {
	records: RecordWithoutEmbedding[];
}

const RelationList = ({ records }: RelationListProps) => {
	return (
		<ul>
			{records.map((record) => (
				<li key={record.id} className="mb-2">
					<RecordLink
						record={record}
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
			<span className="w-[4ch] text-center font-mono text-xs text-c-accent">
				<DirectionIcon className="size-4 shrink-0" />
			</span>
			<RecordLink
				record={record}
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
							<span className="w-[4ch] font-mono text-xs text-c-secondary">
								{record.similarity.toFixed(2)}
							</span>
							<RecordLink
								record={record}
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
