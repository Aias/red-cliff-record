import { Outlet, ScrollRestoration, createRootRoute } from '@tanstack/react-router';
import { Meta, Scripts } from '@tanstack/start';
import type { ReactNode } from 'react';
import { Theme } from '@radix-ui/themes';
import { ThemeProvider } from 'next-themes';

import '@radix-ui/themes/styles.css';
import '../styles/app.css';
import { DefaultCatchBoundary } from '../components/DefaultCatchBoundary';
import { NotFound } from '../components/NotFound';

export const Route = createRootRoute({
	head: () => ({
		title: 'Red Cliff Record | Admin',
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
		],
	}),
	component: RootComponent,
	errorComponent: (props) => {
		return (
			<RootDocument>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
});

// TODO: Something funky going on with the theme and flashes of unstyled content / suspense errors.
function RootComponent() {
	return (
		<RootDocument>
			<ThemeProvider attribute="class" enableSystem>
				<Theme accentColor="grass" radius="small" scaling="90%">
					<Outlet />
				</Theme>
			</ThemeProvider>
		</RootDocument>
	);
}

// TODO: Fix this warning rather than cover it up. See: https://github.com/pacocoursey/next-themes/issues/169
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html suppressHydrationWarning>
			<head>
				<Meta />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
