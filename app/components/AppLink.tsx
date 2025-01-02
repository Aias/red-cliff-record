import { Link as RadixLink, LinkProps as RadixLinkProps } from '@radix-ui/themes';
import { Link as RouterLink, LinkProps as RouterLinkProps } from '@tanstack/react-router';

type StyledLinkProps = RouterLinkProps & {
	styleProps?: RadixLinkProps;
	children: React.ReactNode;
};

export const AppLink = ({ children, styleProps, ...routerProps }: StyledLinkProps) => {
	return (
		<RadixLink asChild {...styleProps}>
			<RouterLink {...routerProps}>{children}</RouterLink>
		</RadixLink>
	);
};
