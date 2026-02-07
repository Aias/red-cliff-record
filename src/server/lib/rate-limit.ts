import { TRPCError } from '@trpc/server';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

/**
 * In-memory sliding-window rate limiter.
 * Returns a `check(key)` function that throws TRPCError (TOO_MANY_REQUESTS) if limit exceeded.
 */
export function createRateLimiter({ windowMs, maxRequests }: RateLimiterOptions) {
  const windows = new Map<string, number[]>();

  // Periodic cleanup to prevent memory leaks from stale keys
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of windows) {
      const filtered = timestamps.filter((t) => now - t < windowMs);
      if (filtered.length === 0) {
        windows.delete(key);
      } else {
        windows.set(key, filtered);
      }
    }
  }, windowMs);

  // Don't block process exit
  cleanup.unref();

  return function check(key: string): void {
    const now = Date.now();
    const timestamps = (windows.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)}s.`,
      });
    }

    timestamps.push(now);
    windows.set(key, timestamps);
  };
}
