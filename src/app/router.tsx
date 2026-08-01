import { QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { deserialize, serialize } from 'superjson';
import type { AppRouter } from '@/server/api/root';
import { DefaultCatchBoundary } from './routes/-app-components/catch-boundary';
import { NotFound } from './routes/-app-components/not-found';
import { routeTree } from './routeTree.gen';
import { TRPCProvider, trpcClient } from './trpc';

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        serializeData: serialize,
      },
      hydrate: {
        deserializeData: deserialize,
      },
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: true,
      },
    },
  });

  const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  });

  return routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      context: { queryClient, trpc },
      defaultPreload: 'intent',
      scrollRestoration: true,
      defaultErrorComponent: DefaultCatchBoundary,
      defaultNotFoundComponent: () => <NotFound />,
      Wrap: (props) => {
        return (
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {props.children}
          </TRPCProvider>
        );
      },
    }),
    queryClient
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
  interface HistoryState {
    focusForm?: boolean;
  }
}
