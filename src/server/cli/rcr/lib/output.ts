import { Effect } from 'effect';
import { Flag, GlobalFlag } from 'effect/cli';
import { formatErrorResult } from './errors';
import type { ResultMeta, ResultValue, SuccessResult } from './types';

export const Raw = GlobalFlag.Setting('raw')({
  flag: Flag.Boolean('raw').pipe(
    Flag.withDescription('Print only the data, without the {data, meta} envelope'),
    Flag.withDefault(false)
  ),
});

export function success<T extends ResultValue>(data: T, meta?: ResultMeta): SuccessResult<T> {
  return { data, meta };
}

const writeLine = (stream: NodeJS.WriteStream, value: unknown) =>
  Effect.callback<void>((resume) => {
    stream.write(JSON.stringify(value) + '\n', () => resume(Effect.void));
  });

export const writeError = (error: unknown) => writeLine(process.stderr, formatErrorResult(error));

/** Run a command's work and print its result to stdout. */
export const respondWith = <S extends SuccessResult<ResultValue>, E, R>(
  work: Effect.Effect<S, E, R>
) =>
  Effect.gen(function* () {
    const startTime = performance.now();
    const result = yield* work;
    const raw = yield* Raw;
    const duration = Math.round(performance.now() - startTime);
    yield* writeLine(
      process.stdout,
      raw ? result.data : { ...result, meta: { ...result.meta, duration } }
    );
  });

/** Run promise-based work, aborting its signal when the command is interrupted. */
export const respond = <A extends ResultValue>(
  work: (signal: AbortSignal) => Promise<SuccessResult<A>>
) => respondWith(Effect.tryPromise({ try: work, catch: (cause) => cause }));
