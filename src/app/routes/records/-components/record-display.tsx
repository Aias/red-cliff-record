import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import { recordTypeIcons } from './type-icons';
import { Avatar } from '@/components/avatar';
import { ExternalLink } from '@/components/external-link';
import { IntegrationLogo } from '@/components/integration-logo';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';

interface RecordDisplayProps {
	recordId: DbId;
	className?: string;
}

const formatDate = (date: Date) => {
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	}).format(date);
};

/**
 * Compact read-only display of a record.
 * Shows all record data in a typographically clean format.
 * Clicking the title navigates to edit that record.
 */
export const RecordDisplay = memo(({ recordId, className }: RecordDisplayProps) => {
	const { data: record, isLoading, isError } = useRecord(recordId);

	if (isLoading) {
		return (
			<div className={cn('card flex items-center justify-center py-6', className)}>
				<Spinner />
			</div>
		);
	}

	if (isError || !record) {
		return (
			<div className={cn('card flex items-center gap-2 py-4 text-c-hint italic', className)}>
				<RectangleEllipsisIcon className="size-4" />
				<span>Record not found (ID: {recordId})</span>
			</div>
		);
	}

	const {
		id,
		type,
		title,
		abbreviation,
		sense,
		url,
		avatarUrl,
		summary,
		content,
		notes,
		mediaCaption,
		sources,
		media,
		recordCreatedAt,
		isCurated,
		isPrivate,
		outgoingLinks,
	} = record;

	// Resolve creator / parent from outgoing links
	let creatorTitle: string | null = null;
	let parentTitle: string | null = null;

	if (outgoingLinks) {
		for (const link of outgoingLinks) {
			if (link.predicate.type === 'creation' && !creatorTitle) {
				creatorTitle = link.target.title;
			}
			if (link.predicate.type === 'containment' && !parentTitle) {
				parentTitle = link.target.title;
			}
		}
	}

	const displayTitle = title ?? creatorTitle ?? (parentTitle ? `↳ ${parentTitle}` : 'Untitled');
	const TypeIcon = recordTypeIcons[type].icon;
	const recordMedia = media ?? [];
	const recordSources = sources ?? [];
	const hasMedia = recordMedia.length > 0;
	const showAvatar = !hasMedia && Boolean(avatarUrl);

	return (
		<article
			className={cn('card flex flex-col gap-4 px-4 py-3 text-sm', className)}
			data-slot="record-display"
		>
			{/* Header */}
			<header className="flex flex-wrap items-start gap-3" data-slot="record-display-header">
				<Avatar
					src={avatarUrl ?? undefined}
					fallback={(displayTitle.charAt(0) ?? type.charAt(0)).toUpperCase()}
					className="size-6"
				/>
				<div className="flex flex-1 flex-col gap-1">
					<div className="flex items-center gap-2">
						<TypeIcon className="size-4 shrink-0 text-c-hint" />
						<Link
							to="/records/$recordId"
							params={{ recordId: id }}
							search={true}
							className="text-base font-semibold text-c-primary underline-offset-4 hover:underline"
						>
							{displayTitle}
						</Link>
						{abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
					</div>
					{sense && <em className="ml-6 text-xs text-c-secondary">{sense}</em>}
				</div>

				{recordSources.length > 0 && (
					<ul className="flex items-center gap-2 text-xs text-c-secondary">
						{recordSources.map((source) => (
							<li key={source}>
								<IntegrationLogo integration={source} />
							</li>
						))}
					</ul>
				)}
			</header>

			{/* URL */}
			{url && (
				<div className="flex items-center gap-2 text-xs text-c-secondary">
					<span className="text-c-hint">Source</span>
					<ExternalLink href={url} className="truncate">
						{(() => {
							try {
								return new URL(url).hostname.replace(/^www\./, '');
							} catch {
								return url;
							}
						})()}
					</ExternalLink>
				</div>
			)}

			{/* Creator / Parent metadata */}
			{(creatorTitle || parentTitle) && (
				<div className="flex flex-col gap-0.5 text-xs text-c-secondary">
					{creatorTitle && <span>By {creatorTitle}</span>}
					{parentTitle && (
						<span>
							From <em>{parentTitle}</em>
						</span>
					)}
				</div>
			)}

			{/* Status badges */}
			{(isPrivate || isCurated) && (
				<ul className="flex flex-wrap gap-2 text-xs text-c-secondary">
					{isPrivate && <li className="rounded-full bg-c-mist px-2 py-1">Private</li>}
					{isCurated && <li className="rounded-full bg-c-mist px-2 py-1">Curated</li>}
				</ul>
			)}

			{/* Media */}
			{hasMedia && (
				<figure className="flex flex-col gap-2">
					<MediaGrid media={recordMedia} />
					{mediaCaption && (
						<figcaption className="text-xs text-c-secondary">{mediaCaption}</figcaption>
					)}
				</figure>
			)}

			{/* Avatar as fallback image */}
			{showAvatar && (
				<figure className="flex flex-col gap-2">
					<img
						src={avatarUrl ?? ''}
						alt={title ?? 'Record avatar'}
						className="h-auto w-full rounded-md border border-c-divider object-cover"
						loading="lazy"
						decoding="async"
					/>
					{mediaCaption && (
						<figcaption className="text-xs text-c-secondary">{mediaCaption}</figcaption>
					)}
				</figure>
			)}

			{/* Media caption without media */}
			{mediaCaption && !hasMedia && !showAvatar && (
				<section className="flex flex-col gap-1" data-slot="record-display-media-caption">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">
						Media caption
					</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{mediaCaption}</p>
				</section>
			)}

			{/* Summary */}
			{summary && (
				<section className="flex flex-col gap-1" data-slot="record-display-summary">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Summary</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{summary}</p>
				</section>
			)}

			{/* Content */}
			{content && (
				<section className="flex flex-col gap-1" data-slot="record-display-content">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Content</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{content}</p>
				</section>
			)}

			{/* Notes */}
			{notes && (
				<section className="flex flex-col gap-1" data-slot="record-display-notes">
					<h4 className="text-xs font-semibold tracking-wide text-c-hint uppercase">Notes</h4>
					<p className="text-sm whitespace-pre-wrap text-c-primary">{notes}</p>
				</section>
			)}

			{/* Metadata */}
			<dl className="grid gap-3 text-xs text-c-secondary md:grid-cols-2">
				<div className="flex flex-col gap-1">
					<dt className="text-c-hint">Created</dt>
					<dd className="text-c-primary">
						<time dateTime={recordCreatedAt.toISOString()}>{formatDate(recordCreatedAt)}</time>
					</dd>
				</div>
			</dl>
		</article>
	);
});

RecordDisplay.displayName = 'RecordDisplay';
