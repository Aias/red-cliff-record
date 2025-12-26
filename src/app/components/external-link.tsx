import { ArrowSquareOut as ExternalLinkIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const ExternalLink = ({
	href,
	children = 'Open',
	className,
	...props
}: { href: string; children?: React.ReactNode } & React.ComponentProps<'a'>) => {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={cn('group', className)}
			{...props}
		>
			{children}
			<ExternalLinkIcon className="opacity-50 group-hover:opacity-100" />
		</a>
	);
};
