import { z } from 'zod';

export const ThemeCookieSchema = z.enum(['light', 'dark']).default('dark');

export type Theme = z.infer<typeof ThemeCookieSchema>;

const COOKIE_NAME = 'theme';

export function readThemeCookie(): Theme {
  if (typeof document === 'undefined') return ThemeCookieSchema.parse(undefined);
  const raw = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const parsed = ThemeCookieSchema.safeParse(raw);
  return parsed.success ? parsed.data : ThemeCookieSchema.parse(undefined);
}

export function writeThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/**
 * Runs in the document head before first paint so the prerendered SPA shell
 * (which defaults to dark) matches the stored preference without flashing.
 */
export const themeInitScript = `(() => {
  const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
  if (match) document.documentElement.dataset.colorScheme = match[1];
})();`;
