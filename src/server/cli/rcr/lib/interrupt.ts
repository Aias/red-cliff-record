export const withInterruptSignal = async <A>(
  work: (signal: AbortSignal) => Promise<A>
): Promise<A> => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    return await work(controller.signal);
  } finally {
    process.off('SIGINT', abort);
    process.off('SIGTERM', abort);
  }
};
