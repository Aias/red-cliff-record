import { memo } from 'react';
import { ExternalLinkIcon, Link2Icon } from '@radix-ui/react-icons';
import { Avatar, Button, Checkbox, Heading, Link, Text } from '@radix-ui/themes';
import type { QueueItem } from './types';

type QueueListItemProps = Omit<QueueItem, 'id'> &
	React.HTMLAttributes<HTMLDivElement> & {
		children?: React.ReactNode;
		handleClick?: () => void;
		handleSelect?: () => void;
		selected?: boolean;
		active?: boolean;
	};

export const QueueListItem = memo(function QueueListItem({
	title,
	avatarUrl,
	externalUrl,
	description,
	mappedId,
	archivedAt,
	children,
	handleClick,
	handleSelect,
	selected,
	active,
	className = '',
	...props
}: QueueListItemProps) {
	return (
		<section
			data-archived={archivedAt ? true : undefined}
			data-mapped={mappedId ? true : undefined}
			className={`flex flex-col gap-2 transition-opacity duration-200 ${className} data-archived:opacity-75`}
			{...props}
			onClick={handleClick}
		>
			<header className="flex items-center gap-2">
				<Avatar
					size="1"
					src={avatarUrl ?? undefined}
					fallback={title[0]!}
					color={archivedAt ? 'gray' : undefined}
				/>
				<Button
					variant="ghost"
					onClick={(e) => {
						e.stopPropagation();
						handleClick?.();
					}}
					asChild
					className="hover:bg-transparent"
					data-status={active ? 'active' : 'inactive'}
					color={archivedAt ? 'gray' : undefined}
				>
					<Heading size="2" as="h4" className="flex-1 justify-stretch text-left">
						{title}
					</Heading>
				</Button>
				{externalUrl && (
					<Button
						variant="ghost"
						size="1"
						asChild
						onClick={(e) => {
							e.stopPropagation();
						}}
					>
						<Link href={externalUrl} target="_blank" rel="noopener noreferrer">
							<ExternalLinkIcon />
						</Link>
					</Button>
				)}
				<Checkbox
					checked={selected}
					onClick={(e) => {
						e.stopPropagation();
						handleSelect?.();
					}}
				/>
			</header>
			{description && (
				<Text size="1" color="gray">
					{description}
				</Text>
			)}
			{children}
			{mappedId && (
				<footer className="flex items-center gap-2 rounded-md border border-divider bg-tint px-3 py-1 text-theme-text">
					<Link2Icon className="size-3.5 text-current" />
					<Text size="1">Mapped to {mappedId}</Text>
				</footer>
			)}
		</section>
	);
});
