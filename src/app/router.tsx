import { QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { createServerSideHelpers } from '@trpc/react-query/server';
import { deserialize, serialize } from 'superjson';
import { DefaultCatchBoundary } from './routes/-app-components/catch-boundary';
import { NotFound } from './routes/-app-components/not-found';
import { routeTree } from './routeTree.gen';
import { trpc, trpcClient } from './trpc';

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
				refetchOnMount: false,
			},
		},
	});

	const serverHelpers = createServerSideHelpers({
		client: trpcClient,
	});

	return routerWithQueryClient(
		createTanStackRouter({
			routeTree,
			context: { queryClient, trpc: serverHelpers },
			defaultPreload: 'intent',
			scrollRestoration: true,
			defaultErrorComponent: DefaultCatchBoundary,
			defaultNotFoundComponent: () => <NotFound />,
			Wrap: (props) => {
				return (
					<trpc.Provider client={trpcClient} queryClient={queryClient}>
						{props.children}
					</trpc.Provider>
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
