import { randomBytes } from 'node:crypto';
import { createFileRoute } from '@tanstack/react-router';

const handle = () => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('OAuth not configured', { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const isDev = process.env.NODE_ENV !== 'production';

  const redirectUri = `${process.env.PUBLIC_URL ?? `http://localhost:${process.env.PUBLIC_DEV_PORT ?? '5173'}`}/api/auth/callback`;

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  // Empty scope — only need identity, no repo access

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${isDev ? '' : '; Secure'}`,
    },
  });
};

export const Route = createFileRoute('/api/auth/github')({
  server: {
    handlers: {
      GET: handle,
    },
  },
});
