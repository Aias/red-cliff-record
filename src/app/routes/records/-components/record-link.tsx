import { memo } from 'react';
import type { MediaType } from '@aias/hozo';
import { Link } from '@tanstack/react-router';
import type { LinkOptions } from '@tanstack/react-router';
import {
	DotsThreeOutlineIcon,
	type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { recordTypeIcons } from './type-icons';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/hover-card';
import { IntegrationLogo } from '@/components/integration-logo';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';

interface RecordAction {
	label: string;
	icon?: PhosphorIcon;
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
	const { data: record, isLoading, isError } = useRecord(id);

	if (isLoading) return <Spinner />;
	if (isError || !record) {
		// Record might be deleted or not found, show placeholder instead of breaking
		return (
			<div className="flex items-center gap-2 text-muted-foreground italic opacity-75">
				<DotsThreeOutlineIcon className="size-4" />
				<span>Record not found (ID: {id})</span>
			</div>
		);
	}

	/* ---------- resolve creator / parent ---------- */
	let creatorTitle: string | undefined | null;
	let parentTitle: string | undefined | null;

	if (record.outgoingLinks) {
		for (const link of record.outgoingLinks) {
			if (link.predicate.type === 'creation' && !creatorTitle) {
				creatorTitle = link.target.title;
			}
			if (link.predicate.type === 'containment' && !parentTitle) {
				parentTitle = link.target.title;
			}
		}
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
			{abbreviation && <span className="ml-1 text-muted-foreground">({abbreviation})</span>}
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
								<DropdownMenuTrigger
									onClick={(e) => e.stopPropagation()}
									render={
										<DotsThreeOutlineIcon
											className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-primary focus-visible:opacity-100 data-open:opacity-100"
											role="button"
										/>
									}
								/>
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
								'absolute inset-0 size-full text-muted-foreground',
								'group-data-[selectable=true]:group-hover:opacity-0',
								'peer-data-open:opacity-0'
							)}
						/>
					</div>

					{/* title row */}
					<div className="flex grow items-center gap-1 overflow-hidden">
						{linkOptions ? (
							<HoverCard>
								<HoverCardTrigger
									delay={300}
									closeDelay={100}
									render={<Link {...linkOptions} />}
									className="mr-auto min-w-0 flex-1 truncate focus-visible:underline"
								>
									{labelElement}
								</HoverCardTrigger>
								<HoverCardContent className="w-96 p-0" align="center" side="left" sideOffset={12}>
									<div className="flex flex-col gap-3">
										{/* Media */}
										{mediaItem && (
											<div className="relative aspect-video w-full overflow-hidden rounded-t-md bg-muted">
												{mediaItem.type === 'image' ? (
													<img
														src={mediaItem.url}
														alt={mediaItem.altText ?? mediaCaption ?? title ?? ''}
														className="size-full object-cover"
														loading="lazy"
														decoding="async"
													/>
												) : (
													<LazyVideo
														src={mediaItem.url}
														className="size-full object-cover"
														autoPlay
														playsInline
														muted
														loop
													/>
												)}
											</div>
										)}

										<div className={cn('flex flex-col gap-2 px-4 pb-4', !mediaItem && 'pt-4')}>
											{/* Title */}
											<div className="flex flex-col gap-0.5">
												<div className="flex items-baseline gap-1.5">
													<h3 className="text-sm leading-tight font-semibold">
														{title ??
															creatorTitle ??
															(parentTitle ? `↳ ${parentTitle}` : 'Untitled')}
													</h3>
													{abbreviation && (
														<span className="shrink-0 text-xs text-muted-foreground">
															({abbreviation})
														</span>
													)}
												</div>
												{sense && (
													<p className="text-xs leading-tight text-muted-foreground italic">
														{sense}
													</p>
												)}
												{url &&
													(() => {
														try {
															const urlObj = new URL(url);
															return (
																<p className="text-[0.625rem] leading-tight text-muted-foreground">
																	{urlObj.hostname.replace(/^www\./, '')}
																</p>
															);
														} catch {
															return null;
														}
													})()}
											</div>

											{/* Metadata */}
											{(creatorTitle || parentTitle) && (
												<div className="flex flex-col gap-1 text-xs text-muted-foreground">
													{creatorTitle && (
														<div className="text-muted-foreground">By {creatorTitle}</div>
													)}
													{parentTitle && (
														<div className="text-muted-foreground">
															From <em>{parentTitle}</em>
														</div>
													)}
												</div>
											)}

											{/* Summary or Content */}
											<p className="line-clamp-6 text-xs leading-relaxed text-foreground empty:hidden">
												{summary ?? content}
											</p>
										</div>
									</div>
								</HoverCardContent>
							</HoverCard>
						) : (
							<strong className="mr-auto min-w-0 flex-1 truncate">{labelElement}</strong>
						)}
						{sense && <span className="shrink truncate text-muted-foreground italic">{sense}</span>}
					</div>

					{/* source logos */}
					<ul className="flex items-center gap-1.5 text-[0.875em] opacity-50">
						{sources?.map((s) => (
							<li key={s}>
								<IntegrationLogo integration={s} />
							</li>
						))}
					</ul>
				</div>

				<p className="line-clamp-1 text-[0.925em] break-all text-muted-foreground">{preview}</p>
			</div>

			{/* thumbnail */}
			{mediaItem && (
				<div className="relative aspect-3/2 h-[2lh] shrink-0 self-center overflow-hidden rounded-md border border-border bg-muted">
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
