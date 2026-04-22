import { MoonIcon, MountainSnowIcon, SearchIcon, SunIcon } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { Basket } from '@/components/basket';
import { Button, LinkButton } from '@/components/button';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { setTheme } from '@/lib/server/theme';
import { styled } from '@/styled-system/jsx';

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
    <styled.div
      css={{
        position: 'fixed',
        inset: '0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <styled.menu
        css={{
          position: 'relative',
          zIndex: '[100]',
          display: 'grid',
          gridTemplateColumns: '[auto 1fr auto]',
          alignItems: 'center',
          flexShrink: '0',
          flexBasis: 'auto',
          gap: '4',
          paddingInline: '4',
          paddingBlock: '2',
          borderBlockEnd: 'border',
          backgroundColor: 'container',
          containerType: 'inline-size',
        }}
      >
        <styled.li css={{ display: 'flex', alignItems: 'center', gap: '3' }}>
          <LinkButton
            variant="solid"
            css={{
              layerStyle: 'chromatic',
              _childIcon: {
                opacity: '75%',
              },
              '& [data-slot="label"]': {
                srOnly: true,
                '@/sm': {
                  srOnly: false,
                },
              },
            }}
            to="/"
          >
            <MountainSnowIcon />
            <span data-slot="label">Red Cliff Record</span>
          </LinkButton>
          <LinkButton variant="ghost" to="/records">
            Index
          </LinkButton>
        </styled.li>
        <styled.li
          css={{
            display: 'flex',
            width: 'full',
            maxWidth: '128',
            minWidth: '0',
            justifySelf: 'center',
          }}
        >
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
                <styled.span css={{ minWidth: '0', flex: '1', truncate: true, textAlign: 'start' }}>
                  Search records...
                </styled.span>
              </Button>
            }
          >
            <SiteSearch />
          </Suspense>
        </styled.li>
        <styled.li
          css={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1' }}
        >
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
            <styled.span css={{ srOnly: true }}>Toggle theme</styled.span>
          </Button>
        </styled.li>
      </styled.menu>

      {children}
    </styled.div>
  );
};
