import { LogInIcon, LogOutIcon, ShieldIcon, ShieldOffIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { Button } from './button';

export function AuthButton() {
  const { data } = trpc.admin.session.useQuery();
  const utils = trpc.useUtils();

  // Dev-only toggle for simulating admin vs public when auth is not configured
  if (import.meta.env.DEV && !data?.authEnabled) {
    const isAdmin = data?.isAdmin ?? true;
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          document.cookie = isAdmin
            ? 'rcr_dev_role=public; path=/'
            : 'rcr_dev_role=; path=/; max-age=0';
          void utils.invalidate();
        }}
        className="gap-1.5 text-xs"
      >
        {isAdmin ? <ShieldIcon className="size-3.5" /> : <ShieldOffIcon className="size-3.5" />}
        {isAdmin ? 'Admin' : 'Public'}
      </Button>
    );
  }

  if (!data?.authEnabled) return null;

  if (data.isAdmin) {
    return (
      <form action="/api/auth/logout" method="POST">
        <Button type="submit" variant="ghost" size="icon">
          <LogOutIcon className="h-5 w-5" />
          <span className="sr-only">Sign out</span>
        </Button>
      </form>
    );
  }

  return (
    <Button variant="ghost" size="icon" asChild>
      <a href="/api/auth/github">
        <LogInIcon className="h-5 w-5" />
        <span className="sr-only">Sign in</span>
      </a>
    </Button>
  );
}
