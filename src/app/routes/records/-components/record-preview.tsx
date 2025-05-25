import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { parseToSingleLine } from '@/app/lib/marked';
import { filterDefined } from '@/app/lib/type-helpers';
import { cn } from '@/app/lib/utils';
import type { DbId } from '@/server/api/routers/common';
import type { MediaType } from '@/server/db/schema';
import { recordTypeIcons } from './type-icons';
import { Avatar } from '@/components/avatar';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import { Separator } from '@/components/ui/separator';
import { usePredicateMap, useRecordWithOutgoingLinks } from '@/lib/hooks/use-records';

interface RecordPreviewProps {
	id: DbId;
	className?: string;
}

export const RecordPreview = memo(({ id, className }: RecordPreviewProps) => {
	const { record, linkedById, outgoing, isLoading } = useRecordWithOutgoingLinks(id);
	const predicates = usePredicateMap();

	if (isLoading || !record) return <Spinner />;

	const {
		title,
		abbreviation,
		sense,
		type,
		media,
		mediaCaption,
		avatarUrl,
		summary,
		content,
		notes,
		sources,
	} = record;

	const creators = outgoing
		.filter((l) => predicates[l.predicateId]?.type === 'creation')
		.map((l) => linkedById[l.targetId])
		.filter(filterDefined);
	const parents = outgoing
		.filter((l) => predicates[l.predicateId]?.type === 'containment')
		.map((l) => linkedById[l.targetId])
		.filter(filterDefined);
	const tags = outgoing
		.filter((l) => predicates[l.predicateId]?.type === 'description')
		.map((l) => linkedById[l.targetId])
		.filter(filterDefined);

	const TypeIcon = recordTypeIcons[type].icon;
	const creatorTitle = creators[0]?.title;
	const parentTitle = parents[0]?.title;

	let mediaItem: { type: MediaType; url: string; altText?: string | null } | null = null;
	if (media?.[0]) {
		mediaItem = media[0];
	} else if (avatarUrl) {
		mediaItem = { type: 'image', url: avatarUrl };
	}

	const displayTitle = title ?? creatorTitle ?? (parentTitle ? `↳ ${parentTitle}` : 'Untitled');
	const mainContent = content ?? summary;

	return (
		<article className={cn('flex flex-col gap-3', className)}>
			{/* Header with avatar, title, type icon, and summary */}
			<header className="flex items-start gap-3">
				<div className="flex shrink-0 items-center gap-2">
					{avatarUrl && (
						<Avatar src={avatarUrl} fallback={displayTitle[0]?.toUpperCase()} className="size-6" />
					)}
					<TypeIcon className="size-4 text-c-hint" />
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="leading-tight font-medium">
						<Link
							to="/records/$recordId"
							params={{ recordId: String(id) }}
							className="text-c-accent hover:underline"
						>
							{displayTitle}
						</Link>
						{abbreviation && <span className="ml-1 font-normal text-c-hint">({abbreviation})</span>}
						{sense && <span className="ml-1 text-c-hint italic">*{sense}*</span>}
					</h3>
					{summary && (
						<p className="mt-1 line-clamp-2 text-sm text-c-secondary">
							<span dangerouslySetInnerHTML={{ __html: parseToSingleLine(summary) }} />
						</p>
					)}
				</div>
				{sources && sources.length > 0 && (
					<div className="flex shrink-0 items-center gap-1 opacity-60">
						{sources.slice(0, 3).map((source) => (
							<IntegrationLogo key={source} integration={source} className="size-3" />
						))}
					</div>
				)}
			</header>

			{/* Media */}
			{mediaItem && (
				<div className="relative aspect-video w-full overflow-hidden rounded-md border border-c-divider bg-c-mist">
					{mediaItem.type === 'image' ? (
						<img
							src={mediaItem.url}
							alt={mediaItem.altText ?? mediaCaption ?? ''}
							className="absolute inset-0 size-full object-cover"
							loading="lazy"
							decoding="async"
						/>
					) : (
						<LazyVideo
							src={mediaItem.url}
							autoPlay
							loop
							muted
							className="absolute inset-0 object-cover"
						/>
					)}
					{mediaCaption && (
						<div className="absolute right-0 bottom-0 left-0 bg-black/60 p-2 text-xs text-white">
							<span dangerouslySetInnerHTML={{ __html: parseToSingleLine(mediaCaption) }} />
						</div>
					)}
				</div>
			)}

			{/* Creators */}
			{creators.length > 0 && (
				<div className="text-sm text-c-secondary">
					<span className="text-c-hint">By: </span>
					{creators.map((creator, i) => (
						<span key={creator.id}>
							<Link
								to="/records/$recordId"
								params={{ recordId: String(creator.id) }}
								className="text-c-accent hover:underline"
							>
								{creator.title}
							</Link>
							{i < creators.length - 1 && ', '}
						</span>
					))}
				</div>
			)}

			{/* Main content */}
			{mainContent && (
				<div className="text-sm leading-relaxed text-c-secondary">
					<div
						className="line-clamp-4"
						dangerouslySetInnerHTML={{ __html: parseToSingleLine(mainContent) }}
					/>
				</div>
			)}

			{/* Tags */}
			{tags.length > 0 && (
				<div className="font-mono text-xs text-c-hint">
					{tags.map((tag) => (
						<Link
							key={tag.id}
							to="/records/$recordId"
							params={{ recordId: String(tag.id) }}
							className="mr-2 hover:text-c-accent"
						>
							#{tag.title}
						</Link>
					))}
				</div>
			)}

			{/* Notes with separator */}
			{notes && (
				<>
					<Separator className="my-2" />
					<div className="text-sm text-c-secondary italic">
						<div
							className="line-clamp-3"
							dangerouslySetInnerHTML={{ __html: parseToSingleLine(notes) }}
						/>
					</div>
				</>
			)}
		</article>
	);
});
