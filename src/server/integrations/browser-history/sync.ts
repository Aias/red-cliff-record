import {
  arcSchema,
  browsingHistory,
  BrowserSchema,
  type Browser,
  type BrowsingHistoryInsert,
} from '@hozo';
import { createClient } from '@libsql/client';
import { and, eq, gt, isNotNull, ne, notLike, sql } from 'drizzle-orm';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { Array as Arr, Config, Context, Data, Effect } from 'effect';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { DbError, SyncPreconditionError } from '../runtime/errors';
import {
  forEachCollect,
  requireRunId,
  type IntegrationDef,
  type SyncSummary,
} from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import {
  CHROME_EPOCH_TO_UNIX_SECONDS,
  chromeEpochMicrosecondsToDatetime,
  collapseSequentialVisits,
  createDailyVisitsQuery,
} from './helpers';
import { DailyVisitsQueryResultSchema } from './types';

const MAX_URL_LENGTH = 1000;
const INSERT_BATCH_SIZE = 100;
const INSERT_CONCURRENCY = 8;

const REMOVABLE_QUERY_PARAMS = [
  'access_token',
  'as',
  'audience',
  'client_id',
  'code',
  'code_challenge',
  'code_challenge_method',
  'connection',
  'consent_verifier',
  'continue',
  'cst',
  'k',
  'login_challenge',
  'login_verifier',
  'nonce',
  'redirect_uri',
  'refresh_token',
  'response_type',
  'scope',
  'sidt',
  'state',
  'TL',
  'upn',
];

export const AllowNewHostname = Context.Reference<boolean>('integrations/AllowNewHostname', {
  defaultValue: () => false,
});

class BrowserNotInstalledError extends Data.TaggedError('BrowserNotInstalledError')<{
  readonly message: string;
}> {}

interface BrowserSpec {
  readonly name: Browser;
  readonly displayName: string;
  readonly historyPath: string;
  readonly cutoffDate?: Date;
}

const BROWSERS: ReadonlyArray<BrowserSpec> = [
  {
    name: BrowserSchema.enum.arc,
    displayName: 'Arc',
    historyPath: 'Library/Application Support/Arc/User Data/Default/History',
  },
  {
    name: BrowserSchema.enum.dia,
    displayName: 'Dia',
    historyPath: 'Library/Application Support/Dia/User Data/Default/History',
    cutoffDate: new Date('2025-06-20'),
  },
];

const browserConnection = (spec: BrowserSpec) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const home = yield* Config.string('HOME');
      const dbPath = `${home}/${spec.historyPath}`;
      const copyPath = `${dbPath}-copy`;
      const sourceFile = Bun.file(dbPath);
      const exists = yield* Effect.tryPromise({
        try: () => sourceFile.exists(),
        catch: (cause) => new DbError({ operation: `${spec.name}.historyFile`, cause }),
      });
      if (!exists) {
        return yield* Effect.fail(
          new BrowserNotInstalledError({
            message: `${spec.displayName} browser not installed (missing file: ${dbPath})`,
          })
        );
      }
      yield* Effect.tryPromise({
        try: () => Bun.write(copyPath, sourceFile),
        catch: (cause) => new DbError({ operation: `${spec.name}.historyCopy`, cause }),
      });
      const client = createClient({ url: `file:${copyPath}`, intMode: 'bigint' });
      return { db: drizzle({ client, relations: arcSchema.relations }), client };
    }),
    ({ client }) => Effect.sync(() => client.close())
  );

const getHostname = Effect.gen(function* () {
  const fromEnv = yield* Config.string('HOSTNAME').pipe(Effect.catch(() => Effect.succeed('')));
  if (fromEnv.trim()) return fromEnv.trim();
  const fromCli = yield* Effect.tryPromise(async () => {
    const proc = Bun.spawn(['hostname'], { stdout: 'pipe', stderr: 'pipe' });
    const stdout = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? stdout.trim() : '';
  }).pipe(Effect.catch(() => Effect.succeed('')));
  return fromCli || 'unknown';
});

const checkHostname = (hostname: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const existing = yield* database.use('browsingHistory.hostname', (client) =>
      client.query.browsingHistory.findFirst({
        where: { hostname },
        columns: { hostname: true },
      })
    );
    if (existing) return;
    if (yield* AllowNewHostname) {
      yield* Effect.logInfo(`Proceeding with new hostname "${hostname}"`);
      return;
    }
    const known = yield* database.use('browsingHistory.hostnames', (client) =>
      client
        .select({ hostname: browsingHistory.hostname })
        .from(browsingHistory)
        .groupBy(browsingHistory.hostname)
    );
    return yield* Effect.fail(
      new SyncPreconditionError({
        message: `Current hostname "${hostname}" has not been seen before (known: ${known.map((row) => row.hostname).join(', ')}). Re-run with --allow-new-hostname to proceed.`,
      })
    );
  });

const getLastSyncPoint = (hostname: string, browser: Browser) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const latestVisit = yield* database.use('browsingHistory.lastVisit', (client) =>
      client.query.browsingHistory.findFirst({
        columns: { viewEpochMicroseconds: true },
        where: { browser, hostname, viewEpochMicroseconds: { isNotNull: true } },
        orderBy: { viewEpochMicroseconds: 'desc' },
      })
    );
    return latestVisit?.viewEpochMicroseconds ?? null;
  });

const toChromeEpochMicroseconds = (date: Date) =>
  BigInt((date.getTime() + CHROME_EPOCH_TO_UNIX_SECONDS * 1000) * 1000);

const fetchNewHistoryEntries = (
  spec: BrowserSpec,
  browserDb: LibSQLDatabase<typeof arcSchema.relations>,
  cutoff: bigint | null
) =>
  Effect.tryPromise({
    try: () =>
      createDailyVisitsQuery(browserDb).where(
        and(
          notLike(arcSchema.urls.url, 'chrome-extension://%'),
          notLike(arcSchema.urls.url, 'chrome://%'),
          notLike(arcSchema.urls.url, 'about:%'),
          isNotNull(arcSchema.urls.url),
          isNotNull(arcSchema.urls.title),
          ne(arcSchema.urls.title, ''),
          ne(arcSchema.urls.url, ''),
          cutoff ? gt(arcSchema.visits.visitTime, Number(cutoff)) : undefined
        )
      ),
    catch: (cause) => new DbError({ operation: `${spec.name}.dailyVisits`, cause }),
  });

const decodeDailyVisits = decodeZod(DailyVisitsQueryResultSchema, 'browser daily visits');

const sanitizeUrl = (url: string): string | null => {
  if (url.length <= MAX_URL_LENGTH) return url;
  try {
    const parsed = new URL(url);
    for (const param of REMOVABLE_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }
    const sanitized = parsed.toString();
    return sanitized.length <= MAX_URL_LENGTH ? sanitized : null;
  } catch {
    return null;
  }
};

type HistoryRow = Omit<BrowsingHistoryInsert, 'integrationRunId'>;

const dedupeMillisecondDuplicates = (entries: ReadonlyArray<HistoryRow>, hostname: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const toMillisecondFloor = (micros: bigint) => (micros / 1000000n) * 1000000n;
    const timestamps = [
      ...new Set(
        entries.flatMap((entry) =>
          entry.viewEpochMicroseconds ? [toMillisecondFloor(entry.viewEpochMicroseconds)] : []
        )
      ),
    ];
    if (timestamps.length === 0) return [...entries];
    const timestampStrings = timestamps.map((timestamp) => timestamp.toString());
    const existingEntries = yield* database.use('browsingHistory.millisecondDuplicates', (client) =>
      client
        .select({
          url: browsingHistory.url,
          viewEpochMicroseconds: browsingHistory.viewEpochMicroseconds,
        })
        .from(browsingHistory)
        .where(
          and(
            eq(browsingHistory.hostname, hostname),
            sql`(${browsingHistory.viewEpochMicroseconds} / 1000000) * 1000000 IN (${sql.join(timestampStrings, sql`, `)})`
          )
        )
    );
    const existingKeys = new Set(
      existingEntries.flatMap((entry) =>
        entry.viewEpochMicroseconds
          ? [`${toMillisecondFloor(entry.viewEpochMicroseconds)}:${entry.url}`]
          : []
      )
    );
    const deduped = entries.filter(
      (entry) =>
        !entry.viewEpochMicroseconds ||
        !existingKeys.has(`${toMillisecondFloor(entry.viewEpochMicroseconds)}:${entry.url}`)
    );
    const skipped = entries.length - deduped.length;
    if (skipped > 0) {
      yield* Effect.logInfo(
        `Pre-filtered ${skipped} entries that already exist at millisecond precision`
      );
    }
    return deduped;
  });

const insertHistoryEntries = (entries: ReadonlyArray<HistoryRow>, runId: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const batches = Arr.chunksOf(entries, INSERT_BATCH_SIZE).map((rows, index) => ({
      rows,
      index,
    }));
    const result = yield* forEachCollect(batches, {
      concurrency: INSERT_CONCURRENCY,
      label: (batch) => `batch ${batch.index + 1}`,
      worker: (batch) =>
        database.use(`browsingHistory.insert:${batch.index}`, (client) =>
          client
            .insert(browsingHistory)
            .values(batch.rows.map((row) => ({ ...row, integrationRunId: runId })))
            .onConflictDoNothing()
            .returning({ id: browsingHistory.id })
        ),
    });
    const inserted = result.successes.reduce((sum, rows) => sum + rows.length, 0);
    return { inserted, failures: result.failures };
  });

const syncBrowser = (spec: BrowserSpec, hostname: string) =>
  Effect.gen(function* () {
    const sink = yield* DebugSink;
    const lastKnownTime = yield* getLastSyncPoint(hostname, spec.name);
    yield* Effect.logInfo(
      lastKnownTime
        ? `Last known visit time: ${chromeEpochMicrosecondsToDatetime(lastKnownTime).toISOString()}`
        : 'Last known visit time: none'
    );
    let effectiveCutoff = lastKnownTime;
    if (spec.cutoffDate) {
      const cutoffMicroseconds = toChromeEpochMicroseconds(spec.cutoffDate);
      if (!effectiveCutoff || cutoffMicroseconds > effectiveCutoff) {
        effectiveCutoff = cutoffMicroseconds;
        yield* Effect.logInfo(`Using browser cutoff date: ${spec.cutoffDate.toISOString()}`);
      }
    }
    const rawHistory = yield* Effect.scoped(
      Effect.gen(function* () {
        const { db } = yield* browserConnection(spec);
        return yield* fetchNewHistoryEntries(spec, db, effectiveCutoff);
      })
    );
    yield* Effect.logInfo(`Retrieved ${rawHistory.length} new history entries`);
    yield* sink.capture({ browser: spec.name, entries: rawHistory });
    const dailyHistory = yield* decodeDailyVisits(rawHistory);
    const collapsedHistory = collapseSequentialVisits(dailyHistory);
    yield* Effect.logInfo(`Collapsed into ${collapsedHistory.length} entries`);
    const processedHistory: Array<HistoryRow> = [];
    let excluded = 0;
    for (const visit of collapsedHistory) {
      const sanitizedUrl = sanitizeUrl(visit.url);
      if (sanitizedUrl === null) {
        excluded++;
        continue;
      }
      processedHistory.push({
        browser: spec.name,
        hostname,
        viewTime: chromeEpochMicrosecondsToDatetime(visit.viewTime),
        viewEpochMicroseconds: BigInt(visit.viewTime),
        viewDuration: visit.viewDuration ? Math.round(visit.viewDuration / 1000000) : 0,
        durationSinceLastView: visit.durationSinceLastView
          ? Math.round(visit.durationSinceLastView / 1000000)
          : 0,
        url: sanitizedUrl,
        pageTitle: visit.pageTitle,
        searchTerms: visit.searchTerms,
        relatedSearches: visit.relatedSearches,
      });
    }
    if (excluded > 0) {
      yield* Effect.logInfo(`Excluded ${excluded} entries with unparseable or overlong URLs`);
    }
    if (sink.enabled) {
      yield* Effect.logInfo(`Debug mode: would insert ${processedHistory.length} history entries`);
      return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
    }
    if (processedHistory.length === 0) {
      yield* Effect.logInfo('No new history entries to insert');
      return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
    }
    const runId = yield* requireRunId;
    const deduped = yield* dedupeMillisecondDuplicates(processedHistory, hostname);
    if (deduped.length === 0) {
      yield* Effect.logInfo('All entries already exist (detected at millisecond precision)');
      return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
    }
    const { inserted, failures } = yield* insertHistoryEntries(deduped, runId);
    yield* Effect.logInfo(
      `Inserted ${inserted} of ${deduped.length} history entries (${deduped.length - inserted} duplicates skipped)`
    );
    return { entriesCreated: inserted, failures } satisfies SyncSummary;
  });

const sync = Effect.gen(function* () {
  const sink = yield* DebugSink;
  const hostname = yield* getHostname;
  yield* Effect.logInfo(`Syncing browser history for hostname "${hostname}"`);
  if (!sink.enabled) {
    yield* checkHostname(hostname);
  }
  const results = yield* Effect.forEach(
    BROWSERS,
    (spec) =>
      syncBrowser(spec, hostname).pipe(
        Effect.catchTag('BrowserNotInstalledError', (error) =>
          Effect.logWarning(`${error.message} Skipping ${spec.displayName} sync.`).pipe(
            Effect.as({ entriesCreated: 0, failures: [] } satisfies SyncSummary)
          )
        ),
        Effect.annotateLogs({ browser: spec.name })
      ),
    { concurrency: BROWSERS.length }
  );
  return {
    entriesCreated: results.reduce((sum, summary) => sum + summary.entriesCreated, 0),
    failures: results.flatMap((summary) => summary.failures),
  } satisfies SyncSummary;
});

export const browserHistoryIntegration: IntegrationDef = {
  integrationType: 'browser_history',
  sync,
};
