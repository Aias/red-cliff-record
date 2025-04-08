import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { recordTypeIcons } from './type-icons';
import { ExternalLink, IntegrationLogo, Placeholder, Spinner } from '@/components';
import type { RecordSelect } from '@/db/schema';
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
					<RelationList records={creators.map(({ creator }) => creator)} />
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
					<RelationList records={created.map(({ record }) => record)} />
				</section>
			)}
			{formatOf.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Format Of</h3>
					<RelationList records={formatOf.map((record) => record)} />
				</section>
			)}
			{references.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">References</h3>
					<RelationList records={references.map(({ target }) => target)} />
				</section>
			)}
			{referencedBy.length > 0 && (
				<section className="px-3">
					<h3 className="mt-4 mb-2">Referenced By</h3>
					<RelationList records={referencedBy.map(({ source }) => source)} />
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
	record: RecordSelect;
	className?: string;
	options?: {
		showExternalLink?: boolean;
	};
}

export const RecordLink = ({
	record,
	className,
	options = { showExternalLink: true },
}: RecordLinkProps) => {
	const { type, title, content, summary, notes, abbreviation, url, sense, sources } = record;
	const TypeIcon = recordTypeIcons[type].icon;
	const label = title || summary || notes || content || 'Untitled Record';

	return (
		<div className={cn('flex items-center gap-1', className)}>
			<TypeIcon className="text-c-symbol" />
			<div className="flex grow items-center gap-1">
				<Link
					className="line-clamp-1"
					to={`/records/$recordId`}
					params={{ recordId: record.id.toString() }}
				>
					{label}
				</Link>
				{abbreviation && <span>({abbreviation})</span>}
				{sense && <em className="text-c-secondary">{sense}</em>}
			</div>
			{url && options.showExternalLink && (
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
};

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
