import { memo } from 'react';
import type { MediaType } from '@aias/hozo';
import { useNavigate } from '@tanstack/react-router';
import { recordTypeIcons } from './type-icons';
import { Avatar } from '@/components/avatar';
import { ExternalLink } from '@/components/external-link';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';

interface RecordDisplayProps {
	recordId: DbId;
	className?: string;
}

/**
 * Compact read-only display of a record.
 * Shows all record data in a typographically clean format.
 * Clicking navigates to edit that record.
 */
export const RecordDisplay = memo(({ recordId, className }: RecordDisplayProps) => {
	const navigate = useNavigate();
	const { data: record, isLoading, isError } = useRecord(recordId);

	if (isLoading) {
		return (
			<div className={cn('card flex items-center justify-center py-8', className)}>
				<Spinner />
			</div>
		);
	}

	if (isError || !record) {
		return (
			<div className={cn('card py-4 text-center text-c-hint italic', className)}>
				Record not found (ID: {recordId})
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

	// Pick media items to display
	const mediaItems: Array<{ type: MediaType; url: string; altText?: string | null }> = [];
	if (media && media.length > 0) {
		media.forEach((m) => mediaItems.push(m));
	} else if (avatarUrl) {
		mediaItems.push({ type: 'image', url: avatarUrl });
	}

	const handleClick = () => {
		void navigate({
			to: '/records/$recordId',
			params: { recordId: id.toString() },
			search: true,
		});
	};

	return (
		<article
			onClick={handleClick}
			className={cn(
				'card cursor-pointer py-3 transition-colors hover:border-c-edge',
				className
			)}
		>
			{/* Header row */}
			<header className="mb-3 flex items-center gap-2 border-b border-c-divider pb-2">
				<Avatar
					src={avatarUrl ?? undefined}
					fallback={(displayTitle.charAt(0) ?? type.charAt(0)).toUpperCase()}
					className="size-6"
				/>
				<span className="mr-auto truncate font-mono text-sm text-c-secondary capitalize">
					{type} #{id}, {recordCreatedAt.toLocaleString()}
				</span>
				{sources && sources.length > 0 && (
					<div className="flex items-center gap-1.5">
						{sources.map((source) => (
							<IntegrationLogo key={source} integration={source} className="text-base" />
						))}
					</div>
				)}
			</header>

			{/* Title section */}
			<div className="mb-3 flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<TypeIcon className="size-5 shrink-0 text-c-hint" />
					<h2 className="text-lg leading-tight font-semibold text-c-display">
						{displayTitle}
						{abbreviation && (
							<span className="ml-2 text-sm font-normal text-c-hint">({abbreviation})</span>
						)}
					</h2>
				</div>
				{sense && <p className="ml-7 text-sm text-c-hint italic">{sense}</p>}
			</div>

			{/* URL */}
			{url && (
				<div className="mb-3 ml-7 flex items-center gap-1 text-sm">
					<ExternalLink href={url} className="truncate text-c-accent hover:underline">
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
				<div className="mb-3 ml-7 flex flex-col gap-0.5 text-sm text-c-secondary">
					{creatorTitle && <span>By {creatorTitle}</span>}
					{parentTitle && (
						<span>
							From <em>{parentTitle}</em>
						</span>
					)}
				</div>
			)}

			{/* Text content sections */}
			<div className="ml-7 flex flex-col gap-3">
				{summary && (
					<div>
						<h3 className="mb-1 text-xs font-semibold text-c-secondary uppercase">Summary</h3>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-c-primary">
							{summary}
						</p>
					</div>
				)}

				{content && (
					<div>
						<h3 className="mb-1 text-xs font-semibold text-c-secondary uppercase">Content</h3>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-c-primary">
							{content}
						</p>
					</div>
				)}

				{notes && (
					<div>
						<h3 className="mb-1 text-xs font-semibold text-c-secondary uppercase">Notes</h3>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-c-primary">{notes}</p>
					</div>
				)}
			</div>

			{/* Media section */}
			{mediaItems.length > 0 && (
				<div className="mt-3">
					<div
						className={cn(
							'grid gap-2',
							mediaItems.length === 1
								? 'grid-cols-1'
								: mediaItems.length === 2
									? 'grid-cols-2'
									: 'grid-cols-3'
						)}
					>
						{mediaItems.map((item, idx) => (
							<div
								key={idx}
								className="relative aspect-video overflow-hidden rounded-md border border-c-divider bg-c-mist"
							>
								{item.type === 'image' ? (
									<img
										src={item.url}
										alt={item.altText ?? mediaCaption ?? ''}
										className="size-full object-cover"
										loading="lazy"
										decoding="async"
									/>
								) : (
									<LazyVideo
										src={item.url}
										aria-label={item.altText ?? mediaCaption ?? undefined}
										className="size-full object-cover"
										autoPlay
										playsInline
										muted
										loop
									/>
								)}
							</div>
						))}
					</div>
					{mediaCaption && (
						<p className="mt-2 text-sm text-c-secondary italic">{mediaCaption}</p>
					)}
				</div>
			)}
		</article>
	);
});

RecordDisplay.displayName = 'RecordDisplay';
