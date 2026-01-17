import { Link, type LinkComponentProps } from '@tanstack/react-router';
import { ArchiveIcon, MoonIcon, SunIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '@/components/button';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { Separator } from '@/components/separator';
import { setTheme } from '@/lib/server/theme';
import { cn } from '@/lib/utils';
import { defaultQueueOptions } from '@/shared/types';
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
      <menu className="relative z-100 flex shrink-0 basis-auto items-center justify-between gap-4 border-b border-c-border surface px-4 py-2">
        <li className="flex items-center gap-4">
          <Link
            to={'/'}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded bg-c-main px-2.5 py-1.5 font-mono text-sm font-medium tracking-normal text-c-main-contrast no-underline transition-colors hover:bg-c-main-active hover:no-underline"
          >
            <ArchiveIcon className="opacity-75" />
            <span>Red Cliff Record</span>
          </Link>
          <Separator orientation="vertical" className="h-5! border-c-border" />
          <NavLink to={'/records'} search={defaultQueueOptions}>
            Records
          </NavLink>
        </li>
        <li className="flex items-center gap-2">
          <SiteSearch />
          <KeyboardShortcutsHelp />
          <Button variant="ghost" onClick={toggleTheme} className="h-9 w-9 p-0">
            {currentTheme === 'light' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </li>
      </menu>

      {children}
    </div>
  );
};
