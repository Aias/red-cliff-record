import { useState, type ReactNode } from 'react';
import { Theme, type ThemeProps } from '@radix-ui/themes';
import { type QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, ScrollRestoration } from '@tanstack/react-router';
import { Meta, Scripts } from '@tanstack/start';
import { type createServerSideHelpers } from '@trpc/react-query/server';
import { type AppRouter } from '~/server/api/root';
import { AppLayout } from '../components/AppLayout';
import { DefaultCatchBoundary } from '../components/DefaultCatchBoundary';
import { NotFound } from '../components/NotFound';
import { seo, SITE_NAME } from '../lib/seo';
import { defaultTheme, getThemeCookie, themeColor } from '../lib/theme';
import baseStyles from '../styles/base.css?url';
import globalStyles from '../styles/globals.css?url';

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: ReturnType<typeof createServerSideHelpers<AppRouter>>;
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
		const { theme: initialTheme } = Route.useLoaderData() as { theme: 'light' | 'dark' };
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
			className={`radix-themes ${appearance}`}
			data-is-root-theme="true"
			data-accent-color={accentColor}
			data-gray-color={grayColor}
			data-has-background="true"
			data-panel-background={panelBackground}
			data-radius={radius}
			data-scaling={scaling}
		>
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
