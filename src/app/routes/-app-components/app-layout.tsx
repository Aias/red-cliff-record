import { MoonIcon, MountainSnowIcon, SearchIcon, SunIcon } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { Basket } from '@/components/basket';
import { Button, LinkButton } from '@/components/button';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { setTheme } from '@/lib/server/theme';

const SiteSearch = lazy(() => import('./site-search').then((m) => ({ default: m.SiteSearch })));

interface AppLayoutProps {
  children: ReactNode;
  currentTheme: 'light' | 'dark';
  onThemeChange: (newTheme: 'light' | 'dark') => void;
}

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    onThemeChange(newTheme);
    void setTheme({ data: { theme: newTheme } });
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <menu className="@container relative z-100 grid shrink-0 basis-auto grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-c-border bg-c-container px-4 py-2 contain-inline-size">
        <li className="flex items-center gap-3">
          <LinkButton
            variant="solid"
            data-chromatic
            css={{
              layerStyle: 'chromatic',
              _childIcon: {
                opacity: '75%',
              },
              '& .label': {
                srOnly: true,
                '@/sm': {
                  srOnly: false,
                },
              },
            }}
            to="/"
          >
            <MountainSnowIcon />
            <span className="label">Red Cliff Record</span>
          </LinkButton>
          <LinkButton variant="ghost" to="/records">
            Index
          </LinkButton>
        </li>
        <li className="flex w-full max-w-lg min-w-0 justify-self-center">
          <Suspense
            fallback={
              <Button
                variant="outline"
                css={{
                  position: 'relative',
                  width: 'full',
                  minWidth: '0',
                  justifyContent: 'flex-start',
                  gap: '3',
                  fontWeight: 'normal',
                  color: 'primary',
                  boxShadow: 'none',
                  _childIcon: {
                    color: 'muted',
                  },
                }}
                disabled
              >
                <SearchIcon />
                <span className="min-w-0 flex-1 truncate text-start">Search records...</span>
              </Button>
            }
          >
            <SiteSearch />
          </Suspense>
        </li>
        <li className="flex items-center justify-end gap-1">
          <Basket />
          <KeyboardShortcutsHelp
            buttonCss={{
              '@container (max-width: 40rem)': {
                srOnly: true,
              },
            }}
          />
          <Button variant="ghost" onClick={toggleTheme} size="icon">
            {currentTheme === 'light' ? <SunIcon /> : <MoonIcon />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </li>
      </menu>

      {children}
    </div>
  );
};
