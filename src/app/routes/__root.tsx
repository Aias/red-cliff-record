import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { TRPCProxy } from '@/app/trpc';
import { Toaster } from '@/components/sonner';
import { Tooltip } from '@/components/tooltip';
import { KeyboardShortcutProvider } from '@/lib/keyboard-shortcuts/context';
import { seo, SITE_NAME } from '@/lib/seo';
import { readThemeCookie, themeInitScript, type Theme } from '@/lib/theme';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import pandaStylesUrl from '../styled-system/styles.css?url';
import { AppLayout } from './-app-components/app-layout';
import { DefaultCatchBoundary } from './-app-components/catch-boundary';
import { NotFound as NotFoundComponent } from './-app-components/not-found';
import { ZeroInit } from './-app-components/zero-init';

export interface RouterAppContext {
  queryClient: QueryClient;
  trpc: TRPCProxy;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    scripts: [{ children: themeInitScript }],
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      ...seo({
        title: SITE_NAME,
        description: `Digital knowledge repository.`,
      }),
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;1,200;1,300;1,400;1,500;1,600;1,700&display=swap',
      },
      { rel: 'stylesheet', href: pandaStylesUrl },
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
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function ErrorComponent(props: ErrorComponentProps) {
  return (
    <RootDocument appearance={readThemeCookie()} isTransitioning={false}>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  );
}

function RootComponent() {
  const [appearance, setAppearance] = useState<Theme>(readThemeCookie);
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
      <ZeroInit>
        <KeyboardShortcutProvider>
          <Tooltip.Provider>
            <AppLayout currentTheme={appearance} onThemeChange={setAppearance}>
              <Outlet />
            </AppLayout>
          </Tooltip.Provider>
        </KeyboardShortcutProvider>
      </ZeroInit>
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
    <html
      className={css({
        palette: 'artifact',
      })}
      data-color-scheme={appearance}
      data-theme-transitioning={isTransitioning || undefined}
      // The prerendered shell always carries the default scheme; the cookie
      // (via themeInitScript pre-paint, then hydration) supplies the real one.
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <styled.div css={{ isolation: 'isolate', boxSize: 'full' }}>{children}</styled.div>
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
