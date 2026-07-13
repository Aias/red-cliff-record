import { AsyncLocalStorage } from 'node:async_hooks';

const bufferStorage = new AsyncLocalStorage<unknown[][]>();

/**
 * Writes a log line to stderr, or to the active buffer when called inside a
 * `withBufferedLogs` scope.
 */
export function writeLogLine(...args: unknown[]): void {
  const buffer = bufferStorage.getStore();
  if (buffer) {
    buffer.push(args);
    return;
  }
  console.error(...args);
}

/**
 * Runs a task with its log output buffered, flushing the buffer as one
 * contiguous block when the task settles (including on error). This lets
 * independent tasks run concurrently without interleaving their streamed
 * output. Scopes nest: an inner scope flushes into its parent's buffer, so
 * the parent still emits a single block.
 */
export async function withBufferedLogs<T>(fn: () => Promise<T>): Promise<T> {
  const buffer: unknown[][] = [];
  try {
    return await bufferStorage.run(buffer, fn);
  } finally {
    for (const args of buffer) {
      writeLogLine(...args);
    }
  }
}
