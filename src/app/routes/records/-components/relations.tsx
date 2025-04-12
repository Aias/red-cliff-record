import { memo, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
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

	const { children, creators, references, parent, referencedBy, created, formatOf } = useMemo(
		() =>
			record ?? {
				children: [],
				creators: [],
				created: [],
				references: [],
				referencedBy: [],
				formatOf: [],
				parent: null,
			},
		[record]
	);

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
			{references.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">References</h3>
					<RelationList records={references} />
				</section>
			)}
			{referencedBy.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Referenced By</h3>
					<RelationList records={referencedBy} />
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

export const SimilarRecords = ({ recordId }: { recordId: number }) => {
	const [record] = trpc.records.get.useSuspenseQuery(recordId);

	// Fetch similar records only if textEmbedding exists
	const { data: similarRecords, isLoading } = trpc.records.similaritySearch.useQuery(
		{
			vector: record.textEmbedding!, // Assert non-null because enabled is true only if it exists
			limit: 10,
			exclude: [recordId],
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
						<li key={record.id} className="flex items-center gap-6">
							<RecordLink
								record={record}
								className="flex-1"
								options={{
									showExternalLink: false,
									showInternalLink: true,
								}}
							/>
							<span className="font-mono text-xs text-c-secondary">
								{record.similarity.toFixed(2)}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p>No similar records found.</p>
			)}
		</section>
	) : null;
};
