import { useState, type ReactNode } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ServerHelpers } from '@/app/trpc';
import stylesUrl from '../styles/app.css?url';
import { AppLayout } from './-app-components/app-layout';
import { DefaultCatchBoundary } from './-app-components/catch-boundary';
import { NotFound } from './-app-components/not-found';
import { seo, SITE_NAME } from '@/lib/seo';
import { getTheme, type Theme } from '@/lib/server/theme';
import { cn } from '@/lib/utils';

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: ServerHelpers;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	loader: () => getTheme(),
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
			{ rel: 'stylesheet', href: stylesUrl },
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
			{ rel: 'manifest', href: '/site.webmanifest', color: '#000000' },
			{ rel: 'icon', href: '/favicon.ico' },
		],
	}),
	component: RootComponent,
	errorComponent: (props) => {
		const { theme: initialTheme } = Route.useLoaderData();
		return (
			<RootDocument appearance={initialTheme}>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
});

function RootComponent() {
	const { theme: initialTheme } = Route.useLoaderData();
	const [appearance, setAppearance] = useState<'light' | 'dark'>(initialTheme);

	return (
		<RootDocument appearance={appearance}>
			<AppLayout currentTheme={appearance} onThemeChange={setAppearance}>
				<Outlet />
			</AppLayout>
		</RootDocument>
	);
}

function RootDocument({
	children,
	appearance,
}: Readonly<{ children: ReactNode; appearance: Theme }>) {
	return (
		<html className={cn('h-viewport w-full', appearance)}>
			<head>
				<HeadContent />
			</head>
			<body className="size-full bg-rcr-background text-rcr-primary">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
