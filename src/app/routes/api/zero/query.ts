import { mustGetQuery } from '@rocicorp/zero';
import { handleQueryRequest } from '@rocicorp/zero/server';
import { createFileRoute } from '@tanstack/react-router';
import { queries } from '@/shared/zero/queries';
import { schema } from '@/shared/zero/schema.gen';

const handle = async ({ request }: { request: Request }) => {
  const response = await handleQueryRequest({
    handler: (name, args) => mustGetQuery(queries, name).fn({ args, ctx: undefined }),
    schema,
    request,
    userID: 'rcr',
  });
  return Response.json(response);
};

export const Route = createFileRoute('/api/zero/query')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
