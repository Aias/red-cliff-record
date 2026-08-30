import {
  githubCommitChanges,
  githubCommits,
  githubRepositories,
  type GithubCommitChangeInsert,
  type GithubCommitInsert,
  type GithubRepositoryInsert,
} from '@hozo';
import type { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { Effect, Option, Stream } from 'effect';
import { db } from '@/server/db/connections/postgres';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError } from '../runtime/errors';
import { forEachCollect, type SyncSummary } from '../runtime/run';
import { ensureGithubUserExists } from './sync-users';
import { toGithubId } from './types';

type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];
type CommitSearchItem = Endpoints['GET /search/commits']['response']['data']['items'][number];

const MAX_PATCH_LENGTH = 2048;
const PER_PAGE = 100;
const MAX_SEARCH_PAGES = 10;
const COMMIT_CONCURRENCY = 8;
const SHA_CHUNK_SIZE = 100;

const getMostRecentCommitDate = Effect.gen(function* () {
  const database = yield* Database;
  const latestByCommitter = yield* database.use('githubCommits.lastCommittedAt', (client) =>
    client.query.githubCommits.findFirst({
      columns: { committedAt: true },
      orderBy: { committedAt: 'desc' },
    })
  );
  const latestByAuthor = yield* database.use('githubCommits.lastAuthoredAt', (client) =>
    client.query.githubCommits.findFirst({
      columns: { contentCreatedAt: true },
      orderBy: { contentCreatedAt: 'desc' },
    })
  );
  const lastActivityTime = Math.max(
    latestByCommitter?.committedAt?.getTime() ?? 0,
    latestByAuthor?.contentCreatedAt?.getTime() ?? 0
  );
  return lastActivityTime ? new Date(lastActivityTime) : null;
});

export const fetchNewCommits = (octokit: Octokit) =>
  Effect.gen(function* () {
    const sink = yield* DebugSink;
    const mostRecentCommitDate = yield* getMostRecentCommitDate;
    yield* Effect.logInfo(
      `Most recent commit activity in database: ${mostRecentCommitDate?.toISOString() ?? 'none'}`
    );
    const queryStr = mostRecentCommitDate
      ? `author:@me committer-date:>=${mostRecentCommitDate.toISOString().split('T')[0]}`
      : 'author:@me';
    const pages = Stream.paginate(1, (page: number) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            octokit.rest.search.commits({
              q: queryStr,
              sort: 'committer-date',
              order: 'asc',
              per_page: PER_PAGE,
              page,
            }),
          catch: (cause) => new ApiRequestError({ resource: `github commits page ${page}`, cause }),
        });
        const items = response.data.items;
        yield* sink.capture(items);
        yield* Effect.logInfo(`Retrieved ${items.length} commits (page ${page})`);
        const hasMore = items.length === PER_PAGE && page < MAX_SEARCH_PAGES;
        return [items, hasMore ? Option.some(page + 1) : Option.none<number>()] as const;
      })
    );
    return yield* Stream.runCollect(pages);
  });

const makeCommitProcessor = (octokit: Octokit, integrationRunId: number) => {
  const repositoryDataCache = new Map<string, Promise<GithubRepository>>();
  const getRepositoryData = (owner: string, repo: string): Promise<GithubRepository> => {
    const key = `${owner}/${repo}`;
    let cached = repositoryDataCache.get(key);
    if (!cached) {
      cached = octokit.rest.repos.get({ owner, repo }).then((response) => response.data);
      repositoryDataCache.set(key, cached);
    }
    return cached;
  };

  const ensureRepositoryExists = async (repoData: GithubRepository): Promise<number> => {
    await ensureGithubUserExists(repoData.owner, integrationRunId);
    const newRepo: GithubRepositoryInsert = {
      id: toGithubId(repoData.id),
      nodeId: repoData.node_id,
      name: repoData.name,
      fullName: repoData.full_name,
      ownerId: toGithubId(repoData.owner.id),
      private: repoData.private,
      htmlUrl: repoData.html_url,
      homepageUrl: repoData.homepage,
      licenseName: repoData.license?.name,
      description: repoData.description,
      language: repoData.language,
      topics: repoData.topics,
      integrationRunId,
      contentCreatedAt: new Date(repoData.created_at),
      contentUpdatedAt: new Date(repoData.updated_at),
    };
    await db
      .insert(githubRepositories)
      .values(newRepo)
      .onConflictDoUpdate({
        target: githubRepositories.id,
        set: { ...newRepo, recordUpdatedAt: new Date() },
      });
    return toGithubId(repoData.id);
  };

  const ensuredRepositories = new Map<number, Promise<number>>();
  const ensureRepositoryOnce = (repoData: GithubRepository): Promise<number> => {
    const repositoryId = toGithubId(repoData.id);
    let ensured = ensuredRepositories.get(repositoryId);
    if (!ensured) {
      ensured = ensureRepositoryExists(repoData);
      ensuredRepositories.set(repositoryId, ensured);
    }
    return ensured;
  };

  return async (item: CommitSearchItem): Promise<'inserted' | 'skipped'> => {
    const repoData = await getRepositoryData(item.repository.owner.login, item.repository.name);
    if (repoData.fork && new Date(item.commit.author.date) < new Date(repoData.created_at)) {
      return 'skipped';
    }
    const detailedCommit = await octokit.rest.repos.getCommit({
      owner: item.repository.owner.login,
      repo: item.repository.name,
      ref: item.sha,
    });
    await ensureRepositoryOnce(repoData);
    const newCommit: GithubCommitInsert = {
      id: item.node_id,
      sha: item.sha,
      message: item.commit.message,
      htmlUrl: item.html_url,
      repositoryId: toGithubId(item.repository.id),
      committedAt: item.commit.committer?.date ? new Date(item.commit.committer.date) : null,
      contentCreatedAt: new Date(item.commit.author.date),
      integrationRunId,
      changes: detailedCommit.data.stats?.total ?? null,
      additions: detailedCommit.data.stats?.additions ?? null,
      deletions: detailedCommit.data.stats?.deletions ?? null,
    };
    await db.insert(githubCommits).values(newCommit);
    const files = detailedCommit.data.files ?? [];
    if (files.length > 0) {
      const newChanges: Array<GithubCommitChangeInsert> = files.map((file) => ({
        filename: file.filename,
        status: file.status,
        patch: file.patch ? file.patch.slice(0, MAX_PATCH_LENGTH) : '',
        commitId: item.node_id,
        changes: file.changes,
        additions: file.additions,
        deletions: file.deletions,
      }));
      await db.insert(githubCommitChanges).values(newChanges);
    }
    return 'inserted';
  };
};

const chunked = <T>(items: ReadonlyArray<T>, size: number): Array<Array<T>> => {
  const chunks: Array<Array<T>> = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const persistCommits = (
  octokit: Octokit,
  items: ReadonlyArray<CommitSearchItem>,
  runId: number
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const existingShas = new Set<string>();
    for (const chunk of chunked(
      items.map((item) => item.sha),
      SHA_CHUNK_SIZE
    )) {
      const rows = yield* database.use('githubCommits.existing', (client) =>
        client.query.githubCommits.findMany({
          columns: { sha: true },
          where: { sha: { in: chunk } },
        })
      );
      for (const row of rows) {
        existingShas.add(row.sha);
      }
    }
    const newItems = items.filter((item) => !existingShas.has(item.sha));
    yield* Effect.logInfo(
      `Processing ${newItems.length} new commits (${existingShas.size} already exist)`
    );
    if (newItems.length === 0) {
      return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
    }
    const processItem = makeCommitProcessor(octokit, runId);
    const results = yield* forEachCollect(newItems, {
      concurrency: COMMIT_CONCURRENCY,
      label: (item) => `${item.repository.full_name}@${item.sha.slice(0, 7)}`,
      worker: (item) =>
        Effect.tryPromise({
          try: () => processItem(item),
          catch: (cause) =>
            new ApiRequestError({ resource: `github commit ${item.sha.slice(0, 7)}`, cause }),
        }),
    });
    const inserted = results.successes.filter((status) => status === 'inserted').length;
    yield* Effect.logInfo(`Inserted ${inserted} of ${newItems.length} commits`);
    return { entriesCreated: inserted, failures: results.failures } satisfies SyncSummary;
  });
