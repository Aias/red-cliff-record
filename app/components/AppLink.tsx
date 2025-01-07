import React from 'react';
import { Link as RadixLink, type LinkProps as RadixLinkProps } from '@radix-ui/themes';
import { createLink, type LinkComponent } from '@tanstack/react-router';

type AppLinkProps = Omit<RadixLinkProps, 'href'>;

const RadixLinkComponent = React.forwardRef<HTMLAnchorElement, AppLinkProps>((props, ref) => {
	return <RadixLink ref={ref} {...props} />;
});

const CreatedLinkComponent = createLink(RadixLinkComponent);

export const AppLink: LinkComponent<typeof RadixLinkComponent> = (props) => {
	return <CreatedLinkComponent preload="intent" {...props} />;
};
