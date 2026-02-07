import { createFileRoute } from '@tanstack/react-router';
import { sessionClearCookieHeader } from '@/server/lib/auth';

const handle = () => {
  const baseUrl =
    process.env.PUBLIC_URL ?? `http://localhost:${process.env.PUBLIC_DEV_PORT ?? '5173'}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${baseUrl}/`,
      'Set-Cookie': sessionClearCookieHeader(),
    },
  });
};

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
