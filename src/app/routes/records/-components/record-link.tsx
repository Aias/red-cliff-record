import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import type { LinkOptions } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { recordTypeIcons } from './type-icons';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePredicateMap, useRecordWithOutgoingLinks } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { MediaType } from '@/shared/types';
import type { DbId } from '@/shared/types';

interface RecordAction {
	label: string;
	icon?: LucideIcon;
	onClick: () => void;
	disabled?: boolean;
}

interface RecordLinkProps {
	id: DbId;
	className?: string;
	linkOptions?: LinkOptions;
	actions?: RecordAction[] | null;
}

export const RecordLink = memo(({ id, className, linkOptions, actions }: RecordLinkProps) => {
	const { record, isLoading, isError, outgoing, linkedById } = useRecordWithOutgoingLinks(id);
	const predicates = usePredicateMap();

	if (isLoading) return <Spinner />;
	if (isError || !record) {
		// Record might be deleted or not found, show placeholder instead of breaking
		return (
			<div className="flex items-center gap-2 text-c-hint italic opacity-75">
				<RectangleEllipsisIcon className="size-4" />
				<span>Record not found (ID: {id})</span>
			</div>
		);
	}

	/* ---------- resolve creator / parent ---------- */
	let creatorTitle: string | undefined | null;
	let parentTitle: string | undefined | null;

	for (const edge of outgoing) {
		const kind = predicates[edge.predicateId]?.type;
		if (kind === 'creation' && !creatorTitle) {
			creatorTitle = linkedById[edge.targetId]?.title;
		}
		if (kind === 'containment' && !parentTitle) {
			parentTitle = linkedById[edge.targetId]?.title;
		}
		if (creatorTitle && parentTitle) break;
	}

	/* ---------- derive text fields ---------- */
	const {
		type,
		title,
		abbreviation,
		sense,
		content,
		summary,
		notes,
		url,
		sources,
		media,
		mediaCaption,
		avatarUrl,
		recordUpdatedAt,
	} = record;

	const preview =
		summary ?? content ?? notes ?? url ?? `Updated ${recordUpdatedAt.toLocaleDateString()}`;

	const labelElement = (
		<>
			{title ?? creatorTitle ?? (parentTitle ? `↳ ${parentTitle}` : 'Untitled')}
			{abbreviation && <span className="ml-1 text-c-hint">({abbreviation})</span>}
		</>
	);

	/* ---------- pick media thumbnail ---------- */
	let mediaItem: { type: MediaType; url: string; altText?: string | null } | null = null;
	if (media?.[0]) {
		mediaItem = media[0];
	} else if (avatarUrl) {
		mediaItem = { type: 'image', url: avatarUrl };
	}

	const TypeIcon = recordTypeIcons[type].icon;

	return (
		<div
			className={cn('group relative flex grow gap-3 overflow-hidden break-all', className)}
			data-selectable={actions && actions.length > 0}
		>
			<div className="flex shrink basis-full flex-col gap-[0.25em] overflow-hidden">
				<div className="flex items-center gap-1.25 overflow-hidden">
					{/* icon / dropdown */}
					<div className="relative size-[1lh] shrink-0">
						{actions && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
									<RectangleEllipsisIcon
										className="peer absolute inset-0 z-10 size-full cursor-pointer themed opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-c-accent focus-visible:opacity-100 data-[state=open]:opacity-100"
										role="button"
									/>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{actions.map((a) => (
										<DropdownMenuItem key={a.label} onClick={a.onClick} disabled={a.disabled}>
											{a.icon && <a.icon />}
											{a.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						<TypeIcon
							className={cn(
								'absolute inset-0 size-full text-c-hint',
								'group-data-[selectable=true]:group-hover:opacity-0',
								'peer-data-[state=open]:opacity-0'
							)}
						/>
					</div>

					{/* title row */}
					<div className="flex grow items-center gap-1 overflow-hidden">
						{linkOptions ? (
							<Link
								className="mr-auto min-w-0 flex-1 truncate focus-visible:underline"
								{...linkOptions}
							>
								{labelElement}
							</Link>
						) : (
							<strong className="mr-auto min-w-0 flex-1 truncate">{labelElement}</strong>
						)}
						{sense && <span className="shrink-1 truncate text-c-hint italic">{sense}</span>}
					</div>

					{/* source logos */}
					<ul className="flex items-center gap-1.5 text-[0.75em] opacity-50">
						{sources?.map((s) => (
							<li key={s}>
								<IntegrationLogo integration={s} />
							</li>
						))}
					</ul>
				</div>

				<p className="line-clamp-1 text-[0.925em] break-all text-c-secondary">{preview}</p>
			</div>

			{/* thumbnail */}
			{mediaItem && (
				<div className="relative aspect-[3/2] h-[2lh] shrink-0 self-center overflow-hidden rounded-md border border-c-divider bg-c-mist">
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
							className="absolute inset-0 size-full object-cover"
							autoPlay
							playsInline
							muted
							loop
						/>
					)}
				</div>
			)}
		</div>
	);
});
