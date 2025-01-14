import { createTRPCReact } from '@trpc/react-query';
import { type createServerSideHelpers } from '@trpc/react-query/server';
import type { AppRouter } from '~/server/api/root';

export const trpc = createTRPCReact<AppRouter>();

export type ServerHelpers = ReturnType<typeof createServerSideHelpers<AppRouter>>;
