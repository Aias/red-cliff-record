import { Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { describeError } from '@/server/integrations/runtime/errors';
import { runFormatEnrichment } from '@/server/services/classify-record-format';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runEloRefit } from '@/server/services/refit-elo';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { runUpdateSourcesIntegration } from '@/server/services/update-sources';
import { positiveIntFlag } from '../lib/args';
import { createError } from '../lib/errors';
import { respondWith, success } from '../lib/output';

const ENRICHMENTS = ['avatars', 'alt-text', 'embeddings', 'formats', 'elo', 'sources'] as const;
type EnrichmentName = (typeof ENRICHMENTS)[number];

const DEFAULT_ENRICHMENTS: ReadonlyArray<EnrichmentName> = [
  'avatars',
  'alt-text',
  'embeddings',
  'elo',
];

interface EnrichOptions {
  debug: boolean;
  limit: number | undefined;
}

const runners: Record<
  EnrichmentName,
  (options: EnrichOptions, signal: AbortSignal) => Promise<object>
> = {
  avatars: async (_options, signal) => {
    await runSaveAvatarsIntegration(signal);
    return {};
  },
  'alt-text': (options, signal) => runAltTextIntegration({ ...options, signal }),
  embeddings: async (_options, signal) => {
    await runEmbedRecordsIntegration(signal);
    return {};
  },
  formats: async ({ limit }, signal) => ({
    assigned: (await runFormatEnrichment({ limit, signal })).entriesCreated,
  }),
  elo: () => runEloRefit(),
  sources: (_options, signal) => runUpdateSourcesIntegration(signal),
};

const runEnrichment = (enrichment: EnrichmentName, options: EnrichOptions) =>
  Effect.gen(function* () {
    const startTime = performance.now();
    const result = yield* Effect.tryPromise({
      try: (signal) => runners[enrichment](options, signal),
      catch: (cause) => cause,
    });
    return {
      enrichment,
      success: true,
      ...result,
      duration: Math.round(performance.now() - startTime),
    };
  });

const runAllEnrichments = (options: EnrichOptions) =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(DEFAULT_ENRICHMENTS, (enrichment) =>
      runEnrichment(enrichment, options).pipe(
        Effect.match({
          onFailure: (error) => ({ enrichment, success: false, error: describeError(error) }),
          onSuccess: () => ({ enrichment, success: true }),
        })
      )
    );
    const succeeded = results.filter((result) => result.success).length;
    return success({
      results,
      summary: {
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
      },
    });
  });

export const enrich = Command.make(
  'enrich',
  {
    enrichment: Argument.Literals('enrichment', ENRICHMENTS).pipe(
      Argument.withDescription(`Enrichment to run; omit to run ${DEFAULT_ENRICHMENTS.join(', ')}`),
      Argument.optional
    ),
    debug: Flag.Boolean('debug').pipe(
      Flag.withDescription('Run without writing results (alt-text only)'),
      Flag.withDefault(false)
    ),
    limit: positiveIntFlag('limit').pipe(
      Flag.withDescription('Maximum records to process (alt-text and formats only)'),
      Flag.optional
    ),
  },
  ({ enrichment, debug, limit }) =>
    respondWith(
      Effect.gen(function* () {
        const options = { debug, limit: Option.getOrUndefined(limit) };
        if (Option.isNone(enrichment)) return yield* runAllEnrichments(options);
        if (
          options.limit !== undefined &&
          enrichment.value !== 'alt-text' &&
          enrichment.value !== 'formats'
        ) {
          return yield* Effect.fail(
            createError(
              'VALIDATION_ERROR',
              '--limit is only supported for `rcr enrich alt-text` and `rcr enrich formats`.'
            )
          );
        }
        return success(yield* runEnrichment(enrichment.value, options));
      })
    )
).pipe(
  Command.withDescription('Run record enrichments'),
  Command.withExamples([
    { command: 'rcr enrich', description: 'Run the default enrichments' },
    { command: 'rcr enrich formats --limit 50', description: 'Assign formats to 50 records' },
  ])
);
