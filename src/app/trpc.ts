import { httpBatchLink, loggerLink, TRPCClientError, type TRPCLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { type createServerSideHelpers } from '@trpc/react-query/server';
import { observable } from '@trpc/server/observable';
import { toast } from 'sonner';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/root';

export const trpc = createTRPCReact<AppRouter>();

export type ServerHelpers = ReturnType<typeof createServerSideHelpers<AppRouter>>;

function getBaseUrl() {
	if (typeof window !== 'undefined') return window.location.origin;
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

function showTRPCError(err: unknown) {
	if (err instanceof TRPCClientError) {
		toast.error(err.message); // human‑readable message from server
	} else {
		toast.error('Unexpected error occurred');
	}
}

const toastLink: TRPCLink<AppRouter> = () => {
	return ({ op, next }) =>
		observable((observer) => {
			const sub = next(op).subscribe({
				next(value) {
					observer.next(value); // forward successful result
				},
				error(err) {
					if (typeof window !== 'undefined') showTRPCError(err);
					observer.error(err); // let React Query handle state
				},
				complete() {
					observer.complete();
				},
			});

			// teardown
			return () => sub.unsubscribe();
		});
};

const ENABLE_LOGGING = false;

export const trpcClient = trpc.createClient({
	links: [
		toastLink,
		loggerLink({
			enabled: () => ENABLE_LOGGING && process.env.NODE_ENV === 'development',
		}),
		httpBatchLink({
			// since we are using Vinxi, the server is running on the same port,
			// this means in dev the url is `http://localhost:3000/trpc`
			// and since its from the same origin, we don't need to explicitly set the full URL
			url: `${getBaseUrl()}/trpc`,
			transformer: superjson,
		}),
	],
});
