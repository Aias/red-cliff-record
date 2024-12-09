import { Link as RadixLink } from '@radix-ui/themes';
import { Link as RouterLink, LinkProps } from '@tanstack/react-router';
import { forwardRef } from 'react';

type StyledLinkProps = LinkProps & {
	children: React.ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, StyledLinkProps>((props, ref) => {
	const { children, ...routerProps } = props;

	return (
		<RadixLink asChild>
			<RouterLink {...routerProps} ref={ref}>
				{children}
			</RouterLink>
		</RadixLink>
	);
});

Link.displayName = 'Link';
