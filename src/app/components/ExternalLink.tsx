import { ExternalLinkIcon } from './icons';

export const ExternalLink = ({
	href,
	children = 'Open',
	...props
}: { href: string; children?: React.ReactNode } & React.ComponentProps<'a'>) => {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" {...props}>
			{children}
			<ExternalLinkIcon />
		</a>
	);
};
