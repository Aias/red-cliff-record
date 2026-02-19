import { Link, type LinkComponentProps } from '@tanstack/react-router';
import { MoonIcon, MountainSnowIcon, SunIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Basket } from '@/components/basket';
import { Button } from '@/components/button';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { Separator } from '@/components/separator';
import { setTheme } from '@/lib/server/theme';
import { cn } from '@/lib/utils';
import { SiteSearch } from './site-search';

interface AppLayoutProps {
  children: ReactNode;
  currentTheme: 'light' | 'dark';
  onThemeChange: (newTheme: 'light' | 'dark') => void;
}

const NavLink = ({ className, ...props }: LinkComponentProps) => {
  return (
    <Link
      {...props}
      className={cn('rounded-md px-2.5 py-1.5 hover:bg-c-splash hover:no-underline', className)}
    />
  );
};

export const AppLayout = ({ children, currentTheme, onThemeChange }: AppLayoutProps) => {
  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    onThemeChange(newTheme);
    void setTheme({ data: { theme: newTheme } });
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <menu className="relative z-100 grid shrink-0 basis-auto grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-c-border surface px-4 py-2">
        <li className="flex items-center gap-4">
          <Link
            to={'/'}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded bg-c-main px-3.5 py-1.5 font-mono text-sm font-medium tracking-normal text-c-main-contrast no-underline transition-colors hover:bg-c-main-active hover:no-underline"
          >
            <MountainSnowIcon className="opacity-75" />
            <span>Red Cliff Record</span>
          </Link>
          <Separator orientation="vertical" className="h-5! border-c-border" />
          <NavLink to={'/records'}>Index</NavLink>
        </li>
        <li className="flex w-full max-w-lg min-w-0 justify-self-center">
          <SiteSearch />
        </li>
        <li className="flex items-center justify-end gap-1">
          <Basket />
          <KeyboardShortcutsHelp />
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
