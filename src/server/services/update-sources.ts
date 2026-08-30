import { records, type IntegrationType } from '@hozo';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { Database } from '@/server/integrations/runtime/db';
import { forEachCollect } from '@/server/integrations/runtime/run';
import { runAppEffect } from '@/server/integrations/runtime/runtime';

const BATCH_SIZE = 200;
const UPDATE_CONCURRENCY = 10;

export interface UpdateSourcesResult {
  scanned: number;
  updated: number;
  failed: number;
}

const fetchRecordBatch = (offset: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
    return yield* database.use('records.sourcesBatch', (client) =>
      client.query.records.findMany({
        limit: BATCH_SIZE,
        offset,
        columns: { id: true, sources: true },
        with: {
          airtableCreators: { columns: { id: true } },
          airtableExtracts: { columns: { id: true } },
          airtableFormats: { columns: { id: true } },
          airtableSpaces: { columns: { id: true } },
          githubRepositories: { columns: { id: true } },
          githubUsers: { columns: { id: true } },
          lightroomImages: { columns: { id: true } },
          raindropBookmarks: { columns: { id: true } },
          raindropCollections: { columns: { id: true } },
          raindropTags: { columns: { id: true } },
          readwiseAuthors: { columns: { id: true } },
          readwiseDocuments: { columns: { id: true } },
          readwiseTags: { columns: { id: true } },
          twitterTweets: { columns: { id: true } },
          twitterUsers: { columns: { id: true } },
        },
      })
    );
  });

type RecordWithRelations = Effect.Success<ReturnType<typeof fetchRecordBatch>>[number];

const deriveSources = (record: RecordWithRelations): IntegrationType[] => {
  const sources: IntegrationType[] = [];
  if (
    record.airtableExtracts.length > 0 ||
    record.airtableCreators.length > 0 ||
    record.airtableFormats.length > 0 ||
    record.airtableSpaces.length > 0
  ) {
    sources.push('airtable');
  }
  if (record.githubRepositories.length > 0 || record.githubUsers.length > 0) {
    sources.push('github');
  }
  if (
    record.raindropBookmarks.length > 0 ||
    record.raindropCollections.length > 0 ||
    record.raindropTags.length > 0
  ) {
    sources.push('raindrop');
  }
  if (
    record.readwiseDocuments.length > 0 ||
    record.readwiseTags.length > 0 ||
    record.readwiseAuthors.length > 0
  ) {
    sources.push('readwise');
  }
  if (record.twitterTweets.length > 0 || record.twitterUsers.length > 0) {
    sources.push('twitter');
  }
  if (record.lightroomImages.length > 0) {
    sources.push('lightroom');
  }
  return sources;
};

const sameMembers = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

const updateSources = Effect.gen(function* () {
  const database = yield* Database;
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let failed = 0;
  while (true) {
    const batch = yield* fetchRecordBatch(offset);
    if (batch.length === 0) break;
    const changed = batch.flatMap((record) => {
      const sources = deriveSources(record);
      return sources.length > 0 && !sameMembers(sources, record.sources ?? [])
        ? [{ id: record.id, sources }]
        : [];
    });
    const result = yield* forEachCollect(changed, {
      concurrency: UPDATE_CONCURRENCY,
      label: (change) => `record ${change.id}`,
      worker: (change) =>
        database.use(`records.updateSources:${change.id}`, (client) =>
          client.update(records).set({ sources: change.sources }).where(eq(records.id, change.id))
        ),
    });
    scanned += batch.length;
    updated += result.successes.length;
    failed += result.failures.length;
    offset += BATCH_SIZE;
    yield* Effect.logInfo(`Scanned ${scanned} records (${updated} updated)`);
  }
  return { scanned, updated, failed } satisfies UpdateSourcesResult;
});

export const runUpdateSourcesIntegration = (): Promise<UpdateSourcesResult> =>
  runAppEffect(
    updateSources.pipe(
      Effect.annotateLogs({ integration: 'enrich.sources' }),
      Effect.withLogSpan('enrich.sources')
    )
  );
