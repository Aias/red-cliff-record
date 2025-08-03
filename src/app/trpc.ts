import {
	httpBatchLink,
	httpLink,
	loggerLink,
	splitLink,
	TRPCClientError,
	type TRPCLink,
} from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { type createServerSideHelpers } from '@trpc/react-query/server';
import { observable } from '@trpc/server/observable';
import { toast } from 'sonner';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/root';
import { PortSchema } from '@/shared/lib/env';

export const trpc = createTRPCReact<AppRouter>();

export type ServerHelpers = ReturnType<typeof createServerSideHelpers<AppRouter>>;

function getBaseUrl() {
	// 1. Running in the browser (dev or prod)
	if (typeof window !== 'undefined') {
		return window.location.origin;
	}

	// 2. Running on the server/edge (dev or prod)
	// Use standard NODE_ENV to check environment
	if (process.env.NODE_ENV === 'production') {
		// Production server/worker: Use the PUBLIC_URL from env vars
		// PUBLIC_URL MUST be set in your deployment environment
		const publicUrl = process.env.PUBLIC_URL;
		if (!publicUrl) {
			// Log a more prominent error in production if the URL is missing
			console.error(
				"\n🔴 CRITICAL ERROR: The 'PUBLIC_URL' environment variable is not set in your production environment." +
					'\n   This is required for server-side tRPC requests to function correctly.' +
					'\n   Please set it in your production environment configuration.\n'
			);
			// Throwing an error might be better to halt deployment/startup if misconfigured
			// throw new Error("PUBLIC_URL environment variable is not set in production.");
			return ''; // Fallback that will likely cause tRPC errors
		}
		return publicUrl;
	} else {
		// Development server (assume anything not 'production' is development)
		// Use localhost and the port (default 3000)
		// Ensure PORT env var matches your dev server if not 3000
		const port = PortSchema.parse(process.env.PUBLIC_DEV_PORT);
		return `http://localhost:${port}`;
	}
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
		splitLink({
			condition: (op) => op.context.skipBatch === true,
			false: httpBatchLink({
				url: `${getBaseUrl()}/api/trpc`,
				transformer: superjson,
				maxURLLength: 1900,
				fetch: (url, options) => {
					const { body, ...restOptions } = options || {};
					const fetchOptions: RequestInit = {
						...restOptions,
						credentials: 'include',
					};
					
					// Handle body if it exists
					if (body !== undefined) {
						// If body is a Uint8Array, convert to ArrayBuffer
						if (body instanceof Uint8Array) {
							// Create a new ArrayBuffer and copy the data
							const arrayBuffer = new ArrayBuffer(body.byteLength);
							const view = new Uint8Array(arrayBuffer);
							view.set(body);
							fetchOptions.body = arrayBuffer;
						} else {
							fetchOptions.body = body;
						}
					}
					
					return fetch(url, fetchOptions);
				},
			}),
			true: httpLink({
				url: `${getBaseUrl()}/api/trpc`,
				transformer: superjson,
				fetch: (url, options) => {
					const { body, ...restOptions } = options || {};
					const fetchOptions: RequestInit = {
						...restOptions,
						credentials: 'include',
					};
					
					// Handle body if it exists
					if (body !== undefined) {
						// If body is a Uint8Array, convert to ArrayBuffer
						if (body instanceof Uint8Array) {
							// Create a new ArrayBuffer and copy the data
							const arrayBuffer = new ArrayBuffer(body.byteLength);
							const view = new Uint8Array(arrayBuffer);
							view.set(body);
							fetchOptions.body = arrayBuffer;
						} else {
							fetchOptions.body = body;
						}
					}
					
					return fetch(url, fetchOptions);
				},
			}),
		}),
	],
});
