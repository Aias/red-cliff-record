import { memo, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { LinkOptions } from '@tanstack/react-router';
import { RectangleEllipsisIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRecord } from '@/app/lib/hooks/use-records';
import type { DbId } from '@/server/api/routers/common';
import { recordTypeIcons } from './type-icons';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	IntegrationLogo,
	Spinner,
} from '@/components';
import type { MediaType } from '@/db/schema';
import { cn } from '@/lib/utils';

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
	const { data: record } = useRecord(id);

	if (!record) return <Spinner />;

	const {
		type,
		title,
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

	const TypeIcon = useMemo(() => recordTypeIcons[type].icon, [type]);
	const label = useMemo(() => {
		if (title) return title;

		return 'Untitled';
	}, [title]);

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
		return summary || content || notes || url || `Updated ${recordUpdatedAt.toLocaleDateString()}`;
	}, [summary, content, notes, url, recordUpdatedAt]);

	return (
		<div
			className={cn('group relative flex grow gap-3 overflow-hidden break-all', className)}
			data-selectable={actions && actions.length > 0}
		>
			<div className="flex shrink basis-full flex-col gap-[0.25em] overflow-hidden">
				<div className="flex items-center gap-1.25 overflow-hidden">
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
									{actions.map((action) => (
										<DropdownMenuItem
											key={action.label}
											onClick={action.onClick}
											disabled={action.disabled}
										>
											{action.icon && <action.icon />}
											{action.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
						<TypeIcon
							className={cn(
								'absolute inset-0 size-full text-c-hint',
								// hide on group hover when selectable
								'group-data-[selectable=true]:group-hover:opacity-0',
								// keep hidden while the dropdown is open
								'peer-data-[state=open]:opacity-0'
							)}
						/>
					</div>
					<div className="flex grow items-center gap-1 overflow-hidden">
						{linkOptions ? (
							<Link
								className="mr-auto min-w-0 flex-1 truncate focus-visible:underline"
								{...linkOptions}
							>
								{label}
							</Link>
						) : (
							<strong className="mr-auto min-w-0 flex-1 truncate">{label}</strong>
						)}
						{sense && <span className="text-c-hint italic">{sense}</span>}
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
				<div className="relative aspect-[3/2] h-[2lh] shrink-0 basis-auto self-center overflow-hidden rounded-md border border-c-divider bg-c-mist">
					{mediaItem.type === 'image' ? (
						<img
							src={mediaItem.url}
							alt={mediaItem.altText ?? mediaCaption ?? ''}
							className="absolute inset-0 size-full object-cover"
						/>
					) : (
						<video src={mediaItem.url} className="absolute inset-0 object-cover" />
					)}
				</div>
			)}
		</div>
	);
});
