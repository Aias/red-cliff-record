import { QueryClient } from '@tanstack/react-query';
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { httpBatchLink } from '@trpc/client';
import { createServerSideHelpers } from '@trpc/react-query/server';
import superjson from 'superjson';
import { DefaultCatchBoundary } from './routes/-app-components/catch-boundary';
import { NotFound } from './routes/-app-components/not-found';
import { routeTree } from './routeTree.gen';
import { trpc } from './trpc';

function getBaseUrl() {
	if (typeof window !== 'undefined') return window.location.origin;
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function createRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: {
				serializeData: superjson.serialize,
			},
			hydrate: {
				deserializeData: superjson.deserialize,
			},
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				refetchOnWindowFocus: false,
			},
		},
	});

	const trpcClient = trpc.createClient({
		links: [
			httpBatchLink({
				// since we are using Vinxi, the server is running on the same port,
				// this means in dev the url is `http://localhost:3000/trpc`
				// and since its from the same origin, we don't need to explicitly set the full URL
				url: `${getBaseUrl()}/trpc`,
				transformer: superjson,
			}),
		],
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
		router: ReturnType<typeof createRouter>;
	}
}
