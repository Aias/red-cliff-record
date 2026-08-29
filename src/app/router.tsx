import { MutationCache, QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { deserialize, serialize } from 'superjson';
import type { AppRouter } from '@/server/api/root';
import { DefaultCatchBoundary } from './routes/-app-components/catch-boundary';
import { NotFound } from './routes/-app-components/not-found';
import { routeTree } from './routeTree.gen';
import { TRPCProvider, trpcClient } from './trpc';

export function getRouter() {
  // Every successful mutation invalidates all queries except those tagged
  // `meta: { invalidation: 'manual' }`. Only active queries refetch (batched
  // into one request by the tRPC batch link); inactive ones are marked stale.
  // Per-mutation cache handlers narrow this default, they don't replace it.
  // Data-less queries are skipped: they have nothing to go stale, and forcing
  // a refetch on an errored query (e.g. a 404 for a deleted record) would
  // resurface the error on every subsequent mutation.
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          predicate: (query) =>
            query.state.data !== undefined && query.meta?.invalidation !== 'manual',
        });
      },
    }),
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

  const router = createTanStackRouter({
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
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
  interface HistoryState {
    focusForm?: boolean;
  }
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** Opt a query out of the global invalidate-on-mutation default. */
      invalidation?: 'manual';
    };
  }
}
