import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ServerHelpers } from '@/app/trpc';
import stylesUrl from '../styles/app.css?url';
import { AppLayout } from './-app-components/app-layout';
import { DefaultCatchBoundary } from './-app-components/catch-boundary';
import { NotFound } from './-app-components/not-found';
import { Toaster } from '@/components/sonner';
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
				title: `${SITE_NAME}`,
				description: `Digital knowledge repository.`,
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
			<RootDocument appearance={initialTheme} isTransitioning={false}>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
});

function RootComponent() {
	const { theme: initialTheme } = Route.useLoaderData();
	const [appearance, setAppearance] = useState<'light' | 'dark'>(initialTheme);
	const [isTransitioning, setIsTransitioning] = useState(false);
	const prevAppearanceRef = useRef(appearance);

	useLayoutEffect(() => {
		// Detect theme changes and disable transitions during the change
		if (prevAppearanceRef.current !== appearance) {
			setIsTransitioning(true);
			prevAppearanceRef.current = appearance;
			// Re-enable transitions after the browser paints the new theme
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					setIsTransitioning(false);
				});
			});
		}
	}, [appearance]);

	return (
		<RootDocument appearance={appearance} isTransitioning={isTransitioning}>
			<AppLayout currentTheme={appearance} onThemeChange={setAppearance}>
				<Outlet />
			</AppLayout>
		</RootDocument>
	);
}

function RootDocument({
	children,
	appearance,
	isTransitioning,
}: Readonly<{ children: ReactNode; appearance: Theme; isTransitioning: boolean }>) {
	useEffect(() => {
		if (import.meta.env.DEV) {
			import('react-scan')
				.then(({ scan }) => {
					scan({
						enabled: false,
					});
				})
				.catch((err) => {
					console.error('Failed to load react-scan:', err);
				});
		}
	}, []);
	return (
		<html className={cn('h-viewport w-full', appearance, isTransitioning && 'theme-transitioning')}>
			<head>
				<HeadContent />
			</head>
			<body className="size-full bg-background text-foreground">
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
