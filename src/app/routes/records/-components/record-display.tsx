import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import { recordTypeIcons } from './type-icons';
import { Avatar } from '@/components/avatar';
import { IntegrationLogo } from '@/components/integration-logo';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';
import { useNavigate } from '@tanstack/react-router';

interface RecordDisplayProps {
	recordId: DbId;
	className?: string;
}

/**
 * Compact read-only display of a record.
 * Shows all record data in a typographically clean format.
 * Clicking the title navigates to edit that record.
 */
export const RecordDisplay = memo(({ recordId, className }: RecordDisplayProps) => {
	const { data: record, isLoading, isError } = useRecord(recordId);
	const navigate = useNavigate();

	if (isLoading) {
		return (
			<div className={cn('flex items-center justify-center py-6', className)}>
				<Spinner />
			</div>
		);
	}

	if (isError || !record) {
		return (
			<div className={cn('flex items-center gap-2 py-4 text-c-hint italic', className)}>
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
		avatarUrl,
		summary,
		content,
		notes,
		mediaCaption,
		sources,
		media,
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

	const TypeIcon = recordTypeIcons[type].icon;
	const recordMedia = media ?? [];
	const recordSources = sources ?? [];
	const hasMedia = recordMedia.length > 0;
	const showAvatar = !hasMedia && Boolean(avatarUrl);

	return (
		<article
			className={cn('flex flex-col gap-4 px-4 text-sm', className)}
			data-slot="record-display"
			onClick={() => {
				void navigate({
					to: '/records/$recordId',
					params: { recordId: id },
					search: true,
				});
			}}
		>
			{/* Header */}
			{avatarUrl || title || abbreviation || sense ? (
				<header className="flex flex-wrap items-center gap-3" data-slot="record-display-header">
					{avatarUrl && (
						<Avatar
							src={avatarUrl}
							fallback={title?.charAt(0) ?? type.charAt(0)}
							className="size-6"
						/>
					)}
					<div className="flex flex-1 flex-col gap-1">
						<div className="flex items-center gap-2">
							<Link
								to="/records/$recordId"
								params={{ recordId: id }}
								search={true}
								className="text-base font-semibold text-c-primary underline-offset-4 hover:underline"
							>
								{title}
							</Link>
							{abbreviation && <span className="text-xs text-c-hint">({abbreviation})</span>}
						</div>
						{sense && <em className="ml-6 text-xs text-c-secondary">{sense}</em>}
					</div>

					<TypeIcon className="size-4 shrink-0 text-c-hint" />
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
			) : null}

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
				<section className="text-sm font-medium whitespace-pre-wrap text-c-primary">
					{summary}
				</section>
			)}

			{/* Content */}
			{content && (
				<section className="text-sm whitespace-pre-wrap text-c-primary">{content}</section>
			)}

			{/* Notes */}
			{notes && (
				<section className="font-mono text-xs whitespace-pre-wrap text-c-secondary">
					{notes}
				</section>
			)}
		</article>
	);
});

RecordDisplay.displayName = 'RecordDisplay';
