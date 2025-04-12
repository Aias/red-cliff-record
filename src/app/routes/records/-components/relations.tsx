import { memo, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { recordTypeIcons } from './type-icons';
import { ExternalLink, IntegrationLogo, Placeholder, Spinner } from '@/components';
import type { MediaSelect, RecordSelect } from '@/db/schema';
import { cn } from '@/lib/utils';

interface RelationsListProps {
	recordId: number;
}

function sortByTime(a: RecordSelect, b: RecordSelect) {
	// Use contentCreatedAt if both records have it, otherwise fall back to recordCreatedAt
	if (a.contentCreatedAt && b.contentCreatedAt) {
		return a.contentCreatedAt.getTime() - b.contentCreatedAt.getTime();
	}
	return a.recordCreatedAt.getTime() - b.recordCreatedAt.getTime();
}

export const RelationsList = ({ recordId }: RelationsListProps) => {
	const { data: record, isLoading } = trpc.records.get.useQuery(recordId, {
		enabled: !!recordId,
	});

	const { children, creators, parent, created, formatOf } = useMemo(
		() =>
			record ?? {
				children: [],
				creators: [],
				created: [],
				formatOf: [],
				parent: null,
			},
		[record]
	);

	const combinedReferences = useMemo(() => {
		if (!record) return [];

		const referencesMap = new Map<
			number,
			{ record: RecordSelect; direction: 'reference' | 'referencedBy' | 'both' }
		>();

		record.references.forEach((ref) => {
			referencesMap.set(ref.id, { record: ref, direction: 'reference' });
		});

		record.referencedBy.forEach((refBy) => {
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
		<div className="text-sm">
			{creators.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Creators</h3>
					<RelationList records={creators} />
				</section>
			)}
			{parent && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Parent</h3>
					<RecordLink record={parent} />
				</section>
			)}
			{children.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Children</h3>
					<RelationList records={children.sort(sortByTime)} />
				</section>
			)}
			{created.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Created</h3>
					<RelationList records={created} />
				</section>
			)}
			{formatOf.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Format Of</h3>
					<RelationList records={formatOf} />
				</section>
			)}
			{combinedReferences.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Relations</h3>
					<ul>
						{combinedReferences.map(({ record: refRecord, direction }) => (
							<li key={refRecord.id}>
								<ReferenceItem record={refRecord} direction={direction} />
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	) : isLoading ? (
		<Placeholder>
			<Spinner />
			<p>Loading...</p>
		</Placeholder>
	) : (
		<div className="py-2 text-muted-foreground">No related records.</div>
	);
};

interface RecordLinkProps {
	record: RecordSelect & { media?: MediaSelect[] };
	className?: string;
	options?: {
		showExternalLink?: boolean;
		showInternalLink?: boolean;
	};
}

const mediaItemClasses =
	'inline-block h-[1lh] w-[1.5lh] shrink-0 grow-0 rounded-sm border border-c-divider object-cover';

export const RecordLink = memo(
	({
		record,
		className,
		options = { showExternalLink: true, showInternalLink: true },
	}: RecordLinkProps) => {
		const {
			type,
			title,
			content,
			summary,
			notes,
			abbreviation,
			url,
			sense,
			sources,
			media,
			mediaCaption,
		} = record;
		const { showInternalLink, showExternalLink } = options;

		const TypeIcon = useMemo(() => recordTypeIcons[type].icon, [type]);
		const label = useMemo(
			() => title || summary || notes || content || 'Untitled Record',
			[title, summary, notes, content]
		);

		const mediaItem = useMemo(() => {
			if (media && media.length > 0 && media[0]) {
				return media[0];
			}
			return null;
		}, [media]);

		return (
			<div className={cn('flex items-center gap-1', className)}>
				<TypeIcon className="text-c-symbol" />
				<div className="flex grow items-center gap-1">
					{showInternalLink ? (
						<Link
							className="mr-auto line-clamp-1"
							to={`/records/$recordId`}
							params={{ recordId: record.id.toString() }}
						>
							{label}
						</Link>
					) : (
						<strong className="mr-auto line-clamp-1">{label}</strong>
					)}
					{abbreviation && <span className="whitespace-nowrap">({abbreviation})</span>}
					{sense && <em className="whitespace-nowrap text-c-secondary">{sense}</em>}
					{mediaItem &&
						(mediaItem.type === 'image' ? (
							<img
								src={mediaItem.url}
								alt={mediaItem.altText || mediaCaption || 'Associated image'}
								className={mediaItemClasses}
								loading="lazy"
							/>
						) : (
							<video
								src={mediaItem.url}
								muted
								loop
								playsInline
								controls={false}
								className={mediaItemClasses}
							/>
						))}
				</div>
				{url && showExternalLink && (
					<ExternalLink
						className="rounded-sm bg-c-mist px-2 text-xs whitespace-nowrap text-c-secondary"
						href={url}
					>
						{new URL(url).hostname}
					</ExternalLink>
				)}
				<ul className="flex items-center gap-1.5 text-[0.75em] opacity-50">
					{sources?.map((source) => (
						<li key={source}>
							<IntegrationLogo integration={source} />
						</li>
					))}
				</ul>
			</div>
		);
	}
);

interface RelationListProps {
	records: RecordSelect[];
}

const RelationList = ({ records }: RelationListProps) => {
	return (
		<ul>
			{records.map((record) => (
				<li key={record.id}>
					<RecordLink record={record} />
				</li>
			))}
		</ul>
	);
};

// New component for displaying combined references with directionality
interface ReferenceItemProps {
	record: RecordSelect;
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
			<RecordLink record={record} className="flex-1" />
		</div>
	);
};

export const SimilarRecords = ({ recordId }: { recordId: number }) => {
	const [record] = trpc.records.get.useSuspenseQuery(recordId);

	const omittedRecordIds = useMemo(() => {
		const { children, creators, references, parent, referencedBy, created, formatOf } = record;
		return [
			record,
			parent,
			...children,
			...creators,
			...created,
			...references,
			...referencedBy,
			...formatOf,
		]
			.map((record) => record?.id)
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
		<section className="px-3 text-sm">
			<h3 className="mt-4 mb-2">Similar Records</h3>
			{isLoading ? (
				<p>Loading...</p>
			) : similarRecords && similarRecords.length > 0 ? (
				<ul>
					{similarRecords.map((record) => (
						<li key={record.id} className="flex items-center gap-4">
							<span className="w-[4ch] font-mono text-xs text-c-secondary">
								{record.similarity.toFixed(2)}
							</span>
							<RecordLink
								record={record}
								className="flex-1"
								options={{
									showExternalLink: false,
									showInternalLink: true,
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
