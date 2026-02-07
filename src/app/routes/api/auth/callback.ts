import { createFileRoute } from '@tanstack/react-router';
import { createSessionCookie, isAdminUser, sessionSetCookieHeader } from '@/server/lib/auth';

const isDev = process.env.NODE_ENV !== 'production';

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  return header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const handle = async ({ request }: { request: Request }) => {
  const baseUrl =
    process.env.PUBLIC_URL ?? `http://localhost:${process.env.PUBLIC_DEV_PORT ?? '5173'}`;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Validate CSRF state
  const cookieState = parseCookie(request.headers.get('cookie'), 'oauth_state');
  const clearStateCookie = `oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isDev ? '' : '; Secure'}`;

  if (!code || !state || state !== cookieState) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/?auth_error=invalid_state`,
        'Set-Cookie': clearStateCookie,
      },
    });
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/?auth_error=token_exchange_failed`,
        'Set-Cookie': clearStateCookie,
      },
    });
  }

  // Fetch GitHub user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const user = (await userRes.json()) as { id?: number };
  if (!user.id) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/?auth_error=user_fetch_failed`,
        'Set-Cookie': clearStateCookie,
      },
    });
  }

  const githubUserId = String(user.id);

  if (!isAdminUser(githubUserId)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/?auth_error=unauthorized`,
        'Set-Cookie': clearStateCookie,
      },
    });
  }

  // Set session cookie and redirect home
  const sessionCookie = createSessionCookie(githubUserId);
  return new Response(null, {
    status: 302,
    headers: [
      ['Location', `${baseUrl}/`],
      ['Set-Cookie', clearStateCookie],
      ['Set-Cookie', sessionSetCookieHeader(sessionCookie)],
    ],
  });
};

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handle,
    },
  },
});
