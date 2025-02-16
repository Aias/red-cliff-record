import * as React from 'react';
import { TabNav } from '@radix-ui/themes';
import { createLink, type LinkComponent } from '@tanstack/react-router';

// TODO: Fix conflicts with base <a> styles. Inactive links should respect Radix theme styles.

interface TabNavLinkProps extends React.ComponentPropsWithoutRef<typeof TabNav.Link> {
	// Add any additional props you want to pass to the TabNav.Link
	active?: boolean;
}

const TabNavLinkComponent = React.forwardRef<HTMLAnchorElement, TabNavLinkProps>((props, ref) => {
	const { active, ...rest } = props;
	return <TabNav.Link ref={ref} active={active} {...rest} />;
});

const CreatedLinkComponent = createLink(TabNavLinkComponent);

export const TabNavLink: LinkComponent<typeof TabNavLinkComponent> = (props) => {
	return <CreatedLinkComponent preload="intent" {...props} />;
};
