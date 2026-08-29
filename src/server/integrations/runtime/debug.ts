import { Context, Effect, Layer } from 'effect';

/**
 * Debug-mode sink for raw API payloads. The disabled layer is ambient;
 * `--debug` swaps in the capture layer, which buffers everything handed to
 * `capture` and flushes it to `.temp/` when the run's scope closes. Syncs
 * consult `enabled` to skip persistence entirely in debug mode.
 */
export class DebugSink extends Context.Service<
  DebugSink,
  {
    readonly enabled: boolean;
    readonly capture: (data: unknown) => Effect.Effect<void>;
  }
>()('integrations/DebugSink') {}

export const debugSinkDisabled = Layer.succeed(DebugSink, {
  enabled: false,
  capture: () => Effect.void,
});

const bigintReplacer = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value;

export const debugSinkCapture = (integration: string) =>
  Layer.effect(
    DebugSink,
    Effect.gen(function* () {
      const buffer: Array<unknown> = [];
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          if (buffer.length === 0) return;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const path = `.temp/${integration}-${timestamp}.json`;
          const contents = buffer.length === 1 ? buffer[0] : buffer;
          yield* Effect.tryPromise(() =>
            Bun.write(path, JSON.stringify(contents, bigintReplacer, 2))
          );
          yield* Effect.logInfo(`Debug output written to ${path}`);
        }).pipe(Effect.catch((error) => Effect.logError('Failed to write debug output', error)))
      );
      return {
        enabled: true,
        capture: (data) =>
          Effect.sync(() => {
            buffer.push(data);
          }),
      };
    })
  );
