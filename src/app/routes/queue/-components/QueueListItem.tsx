import { ExternalLinkIcon } from '@radix-ui/react-icons';
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

export function QueueItem({
	title,
	avatarUrl,
	externalUrl,
	description,
	// mapped,
	// archivedAt,
	children,
	handleClick,
	handleSelect,
	selected,
	active,
	className = '',
	...props
}: QueueListItemProps) {
	return (
		<section className={`flex flex-col gap-2 ${className}`} {...props} onClick={handleClick}>
			<header className="flex items-center gap-2">
				<Avatar size="1" src={avatarUrl ?? undefined} fallback={title[0]!} />
				<Button
					variant="ghost"
					onClick={(e) => {
						e.stopPropagation();
						handleClick?.();
					}}
					asChild
					className="hover:bg-transparent"
					data-status={active ? 'active' : 'inactive'}
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
			{/* <footer>
				{mapped && <Text size="2">Mapped</Text>}
				{archivedAt && <Text size="2">Archived on {archivedAt.toLocaleString()}</Text>}
			</footer> */}
		</section>
	);
}
