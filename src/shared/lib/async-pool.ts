/**
 * Run async operations with bounded concurrency.
 *
 * Unlike batch-based Promise.all, this keeps all worker slots filled:
 * as soon as one operation completes, the next item is picked up immediately.
 * This is more efficient for I/O-bound tasks with variable latency.
 *
 * @example
 * const results = await runConcurrentPool({
 *   items: mediaIds,
 *   concurrency: 10,
 *   timeoutMs: 30_000,
 *   worker: async (id, index, signal) => {
 *     return await processMedia(id, { signal });
 *   },
 * });
 * const successfulValues = results.filter((r) => r.ok).map((r) => r.value);
 */

export interface ConcurrentPoolOptions<T, R> {
  /** Items to process */
  items: T[];
  /** Number of concurrent workers (must be >= 1) */
  concurrency: number;
  /** Process a single item. Receives the item, its index, and an AbortSignal for timeout. */
  worker: (item: T, index: number, signal: AbortSignal) => Promise<R>;
  /** Optional timeout per item in milliseconds */
  timeoutMs?: number;
  /** Optional progress callback, called after each item settles (success/error/timeout) */
  onProgress?: (completed: number, total: number) => void;
}

export type ConcurrentPoolItemResult<R> =
  | { ok: true; value: R }
  | { ok: false; error: Error; timedOut: boolean };

/**
 * Execute a worker function over items with bounded concurrency.
 * Results are returned in the same order as input items.
 */
export async function runConcurrentPool<T, R>(
  options: ConcurrentPoolOptions<T, R>
): Promise<Array<ConcurrentPoolItemResult<R>>> {
  const { items, concurrency, worker, timeoutMs, onProgress } = options;

  if (items.length === 0) {
    return [];
  }

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(
      `runConcurrentPool: concurrency must be an integer >= 1 (received: ${String(concurrency)})`
    );
  }

  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(
      `runConcurrentPool: timeoutMs must be a finite number > 0 (received: ${String(timeoutMs)})`
    );
  }

  const results: Array<ConcurrentPoolItemResult<R>> = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;

  const workerCount = Math.min(concurrency, items.length);

  const runWorker = async () => {
    const timeoutSentinel = Symbol('timeout');

    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;

      const item = items[index];
      if (item === undefined) {
        results[index] = {
          ok: false,
          error: new Error(`runConcurrentPool: missing item at index ${index}`),
          timedOut: false,
        };
        completedCount++;
        onProgress?.(completedCount, items.length);
        continue;
      }
      const controller = new AbortController();

      const workerPromise = Promise.resolve().then(() => worker(item, index, controller.signal));

      if (timeoutMs === undefined) {
        try {
          const value = await workerPromise;
          results[index] = { ok: true, value };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          results[index] = { ok: false, error: err, timedOut: false };
        }
      } else {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<typeof timeoutSentinel>((resolve) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            resolve(timeoutSentinel);
          }, timeoutMs);
        });

        try {
          const raceResult = await Promise.race([workerPromise, timeoutPromise]);
          if (raceResult === timeoutSentinel) {
            // Avoid unhandled rejections from the "losing" promise.
            void workerPromise.catch(() => {});
            results[index] = {
              ok: false,
              error: new Error(`Timed out after ${timeoutMs}ms`),
              timedOut: true,
            };
          } else {
            results[index] = { ok: true, value: raceResult };
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          results[index] = { ok: false, error: err, timedOut: controller.signal.aborted };
        } finally {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
        }
      }

      completedCount++;
      onProgress?.(completedCount, items.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}
