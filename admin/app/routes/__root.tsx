import { Outlet, ScrollRestoration, createRootRoute } from '@tanstack/react-router';
import { createServerFn, Meta, Scripts } from '@tanstack/start';
import { useState, type ReactNode } from 'react';
import { Theme } from '@radix-ui/themes';
import { grass } from '@radix-ui/colors';

import radixStyles from '@radix-ui/themes/styles.css?url';

import { DefaultCatchBoundary } from '../components/DefaultCatchBoundary';
import { NotFound } from '../components/NotFound';
import { seo, SITE_NAME } from '../lib/seo';
import { AppLayout } from '../components/AppLayout';
import { z } from 'zod';
import { getCookie } from 'vinxi/http';

export const getThemeCookie = createServerFn({ method: 'GET' }).handler(async () => {
	const theme = z.enum(['light', 'dark']).default('dark').parse(getCookie('theme'));
	return { theme };
});

export const Route = createRootRoute({
	loader: () => getThemeCookie(),
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1, user-scalable=no',
			},
			...seo({
				title: `${SITE_NAME} | Admin`,
				description: `Admin dashboard for ${SITE_NAME}`,
			}),
		],
		links: [
			{ rel: 'stylesheet', href: radixStyles },
			{
				rel: 'apple-touch-icon',
				sizes: '180x180',
				href: '/apple-touch-icon.png',
			},
			{
				rel: 'icon',
				type: 'image/png',
				sizes: '32x32',
				href: '/favicon-32x32.png',
			},
			{
				rel: 'icon',
				type: 'image/png',
				sizes: '16x16',
				href: '/favicon-16x16.png',
			},
			{ rel: 'manifest', href: '/site.webmanifest', color: grass.grass9 },
			{ rel: 'icon', href: '/favicon.ico' },
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

// TODO: Something funky going on with suspense/hydration errors on initial load.
function RootComponent() {
	const { theme: initialTheme } = Route.useLoaderData() as { theme: 'light' | 'dark' };

	// Store the current theme in state, initialized from the server-provided theme
	const [appearance, setAppearance] = useState<'light' | 'dark'>(initialTheme);
	return (
		<RootDocument>
			<Theme accentColor="grass" radius="small" scaling="90%" appearance={appearance}>
				<AppLayout currentTheme={appearance} onThemeChange={setAppearance}>
					<Outlet />
				</AppLayout>
			</Theme>
		</RootDocument>
	);
}

// TODO: Fix this warning rather than cover it up. See: https://github.com/pacocoursey/next-themes/issues/169
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html>
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
