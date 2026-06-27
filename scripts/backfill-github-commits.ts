/**
 * TEMPORARY backfill script — delete once the GitHub commit history is backfilled.
 *
 * The live sync (`rcr sync github`) only walks forward from the most recent
 * commit and GitHub caps any search at 1000 results, so deep history is
 * unreachable from a single query. This script windows each configured
 * commit-search query by date — keeping every window under the cap — to pull the
 * full history, then rebuilds records and marks non-owned repos private.
 *
 * It reuses the live sync's per-commit upsert, so it is idempotent (existing
 * SHAs are skipped) and resumable: if it dies, rerun it.
 *
 * Usage:
 *   bun scripts/backfill-github-commits.ts [options]
 *   NODE_ENV=development bun scripts/backfill-github-commits.ts   # target dev DB
 *
 * Options:
 *   --from=YYYY-MM-DD   Start date (default: authenticated account creation)
 *   --to=YYYY-MM-DD     End date (default: today) — bound a range to run in batches
 *   --window-days=N     Search window size in days (default: 30)
 *   --query="..."       Run a single search query instead of all configured ones
 *   --summaries         Generate AI summaries for new commits afterward
 *   --dry-run           Fetch and count only; no database writes
 */

import { integrationRuns, IntegrationStatusSchema, records, RunTypeSchema } from '@hozo';
import { Octokit } from '@octokit/rest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import {
  createRecordsFromGithubRepositories,
  createRecordsFromGithubUsers,
  getOwnerUserId,
} from '@/server/integrations/github/map';
import { syncCommitSummaries } from '@/server/integrations/github/summarize-commits';
import {
  getCommitSearchQueries,
  upsertCommitFromSearchItem,
} from '@/server/integrations/github/sync-commits';

const DAY_MS = 24 * 60 * 60 * 1000;
const PER_PAGE = 100;
const SEARCH_RESULT_CAP = 1000;
const REQUEST_DELAY_MS = 1000;
const SEARCH_DELAY_MS = 2000;

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (name: string): string | undefined => {
    const match = args.find((arg) => arg.startsWith(`--${name}=`));
    return match ? match.slice(name.length + 3) : undefined;
  };
  const flag = (name: string): boolean => args.includes(`--${name}`);

  const fromStr = value('from');
  const toStr = value('to');
  const windowDaysStr = value('window-days');
  return {
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
    windowDays: windowDaysStr ? Number(windowDaysStr) : 30,
    query: value('query'),
    summaries: flag('summaries'),
    dryRun: flag('dry-run'),
  };
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function* dateWindows(
  from: Date,
  to: Date,
  windowDays: number
): Generator<{ start: Date; end: Date }> {
  let start = new Date(from);
  while (start.getTime() <= to.getTime()) {
    const windowEnd = new Date(start.getTime() + (windowDays - 1) * DAY_MS);
    const end = windowEnd.getTime() > to.getTime() ? new Date(to) : windowEnd;
    yield { start, end };
    start = new Date(end.getTime() + DAY_MS);
  }
}

async function backfillQuery(
  octokit: Octokit,
  query: string,
  from: Date,
  to: Date,
  windowDays: number,
  integrationRunId: number,
  dryRun: boolean
): Promise<number> {
  let inserted = 0;

  for (const { start, end } of dateWindows(from, to, windowDays)) {
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);
    let page = 1;

    while (true) {
      const response = await octokit.rest.search.commits({
        q: `${query} committer-date:${startStr}..${endStr}`,
        sort: 'committer-date',
        order: 'asc',
        per_page: PER_PAGE,
        page,
      });

      if (page === 1) {
        const total = response.data.total_count;
        if (total === 0) break;
        const remaining = response.headers['x-ratelimit-remaining'];
        console.log(
          `[${query}] ${startStr}..${endStr}: ${total} results (search rate left: ${remaining})`
        );
        if (total > SEARCH_RESULT_CAP) {
          console.warn(
            `  ⚠ window exceeds the ${SEARCH_RESULT_CAP}-result cap; rerun with a smaller --window-days for this range`
          );
        }
      }

      const items = response.data.items;
      if (items.length === 0) break;

      for (const item of items) {
        if (!item) continue;
        try {
          const result = await upsertCommitFromSearchItem(octokit, item, integrationRunId, dryRun);
          if (result === 'inserted') inserted++;
        } catch (error) {
          console.error(`  error on ${item.sha} (${item.repository?.full_name})`, error);
        }
        await Bun.sleep(REQUEST_DELAY_MS);
      }

      if (items.length < PER_PAGE) break;
      page++;
      await Bun.sleep(SEARCH_DELAY_MS);
    }

    await Bun.sleep(SEARCH_DELAY_MS);
  }

  return inserted;
}

/**
 * Marks records for repos the user doesn't own as private. The live mapping does
 * this for newly created records; this fixes records created before the rule.
 */
async function markNonOwnedReposPrivate(ownerUserId: number): Promise<number> {
  const nonOwned = await db.query.githubRepositories.findMany({
    columns: { recordId: true },
    where: {
      ownerId: { ne: ownerUserId },
      recordId: { isNotNull: true },
    },
  });

  const recordIds = nonOwned.map((repo) => repo.recordId).filter((id): id is number => id !== null);

  if (recordIds.length > 0) {
    await db
      .update(records)
      .set({ isPrivate: true, recordUpdatedAt: new Date() })
      .where(inArray(records.id, recordIds));
  }

  return recordIds.length;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const { data: me } = await octokit.rest.users.getAuthenticated();
  const from = options.from ?? new Date(me.created_at);
  const to = options.to ?? new Date();
  const queries = options.query ? [options.query] : getCommitSearchQueries();

  console.log(
    `Backfilling ${queries.length} ${queries.length === 1 ? 'query' : 'queries'} from ${toDateStr(from)} to ${toDateStr(to)} in ${options.windowDays}-day windows${options.dryRun ? ' [DRY RUN]' : ''}:`
  );
  for (const query of queries) console.log(`  - ${query}`);

  if (options.dryRun) {
    let total = 0;
    for (const query of queries) {
      total += await backfillQuery(octokit, query, from, to, options.windowDays, -1, true);
    }
    console.log(`[DRY RUN] would process ${total} commits (existing SHAs not deducted)`);
    return;
  }

  const [run] = await db
    .insert(integrationRuns)
    .values({
      integrationType: 'github',
      runType: RunTypeSchema.enum.sync,
      runStartTime: new Date(),
    })
    .returning();
  if (!run) throw new Error('Failed to create integration run record');

  let total = 0;
  try {
    for (const query of queries) {
      total += await backfillQuery(octokit, query, from, to, options.windowDays, run.id, false);
    }
    await db
      .update(integrationRuns)
      .set({
        status: IntegrationStatusSchema.enum.success,
        runEndTime: new Date(),
        entriesCreated: total,
      })
      .where(eq(integrationRuns.id, run.id));
  } catch (error) {
    await db
      .update(integrationRuns)
      .set({
        status: IntegrationStatusSchema.enum.fail,
        runEndTime: new Date(),
        message: error instanceof Error ? error.message : String(error),
      })
      .where(eq(integrationRuns.id, run.id));
    throw error;
  }

  console.log(`Inserted ${total} new commits. Building records...`);
  await createRecordsFromGithubUsers();
  await createRecordsFromGithubRepositories();

  const ownerUserId = await getOwnerUserId();
  const privateCount = await markNonOwnedReposPrivate(ownerUserId);
  console.log(`Marked ${privateCount} non-owned repo records private.`);

  if (options.summaries) {
    console.log('Generating commit summaries...');
    await syncCommitSummaries();
  }

  console.log('Backfill complete.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
