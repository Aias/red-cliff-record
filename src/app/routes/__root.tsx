import { useState, type ReactNode } from 'react';
import { Theme, type ThemeProps } from '@radix-ui/themes';
import { type QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ServerHelpers } from '~/app/trpc';
import baseStyles from '../styles/base.css?url';
import globalStyles from '../styles/globals.css?url';
import { AppLayout, DefaultCatchBoundary, NotFound } from '~/components';
import { seo, SITE_NAME } from '~/lib/seo';
import { defaultTheme, getThemeCookie, themeColor } from '~/lib/theme';
import { cn } from '~/lib/utils';

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: ServerHelpers;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
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
			{
				rel: 'stylesheet',
				href: baseStyles,
			},
			{
				rel: 'stylesheet',
				href: globalStyles,
			},
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
			{ rel: 'manifest', href: '/site.webmanifest', color: themeColor },
			{ rel: 'icon', href: '/favicon.ico' },
		],
	}),
	component: RootComponent,
	errorComponent: (props) => {
		const { theme: initialTheme } = Route.useLoaderData();
		return (
			<RootDocument theme={{ ...defaultTheme, appearance: initialTheme }}>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
});

function RootComponent() {
	const { theme: initialTheme } = Route.useLoaderData() as { theme: 'light' | 'dark' };
	const [appearance, setAppearance] = useState<'light' | 'dark'>(initialTheme);

	return (
		<RootDocument theme={{ ...defaultTheme, appearance: appearance }}>
			<Theme
				accentColor={defaultTheme.accentColor}
				radius={defaultTheme.radius}
				scaling={defaultTheme.scaling}
				appearance={appearance}
			>
				<AppLayout currentTheme={appearance} onThemeChange={setAppearance}>
					<Outlet />
				</AppLayout>
			</Theme>
		</RootDocument>
	);
}

function RootDocument({ children, theme }: Readonly<{ children: ReactNode; theme: ThemeProps }>) {
	const { appearance, radius, scaling, grayColor, accentColor, panelBackground } = theme;
	return (
		<html
			className={cn('radix-themes', appearance)}
			data-is-root-theme="true"
			data-accent-color={accentColor}
			data-gray-color={grayColor}
			data-has-background="true"
			data-panel-background={panelBackground}
			data-radius={radius}
			data-scaling={scaling}
		>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
