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
import { Array as Arr, Effect, Option, Stream, Tuple } from 'effect';
import { db } from '@/server/db/connections/postgres';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError } from '../runtime/errors';
import { forEachCollect, type ItemFailure, type SyncSummary } from '../runtime/run';
import { scanRepositories, type ScannedRepository } from './scan-repositories';
import { ensureGithubUserExists } from './sync-users';
import { toGithubId, type CommitCandidate } from './types';

type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];
type CommitSearchItem = Endpoints['GET /search/commits']['response']['data']['items'][number];
type DetailedCommit = Endpoints['GET /repos/{owner}/{repo}/commits/{ref}']['response']['data'];

export interface FetchedCommits {
  readonly candidates: ReadonlyArray<CommitCandidate>;
  readonly failures: ReadonlyArray<ItemFailure>;
  readonly scanned: ReadonlyArray<ScannedRepository>;
}

interface HydratedCommit {
  readonly candidate: CommitCandidate;
  readonly repository: GithubRepository;
  readonly detail: DetailedCommit;
}

interface CommitHydration {
  readonly candidateCount: number;
  readonly commits: ReadonlyArray<HydratedCommit>;
  readonly failures: ReadonlyArray<ItemFailure>;
  readonly settledShas: ReadonlySet<string>;
}

interface CommitPersistence extends SyncSummary {
  readonly persistedShas: ReadonlyArray<string>;
}

const MAX_PATCH_LENGTH = 2048;
const PER_PAGE = 100;
const MAX_SEARCH_PAGES = 10;
const COMMIT_CONCURRENCY = 8;
const SHA_CHUNK_SIZE = 100;

const fromSearchItem = (item: CommitSearchItem): CommitCandidate => ({
  sha: item.sha,
  nodeId: item.node_id,
  htmlUrl: item.html_url,
  message: item.commit.message,
  authoredAt: item.commit.author.date,
  committedAt: item.commit.committer?.date ?? null,
  repoOwner: item.repository.owner.login,
  repoName: item.repository.name,
  repoFullName: item.repository.full_name,
});

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

const searchRecentCommits = (octokit: Octokit) =>
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
        return Tuple.make(
          items.map(fromSearchItem),
          hasMore ? Option.some(page + 1) : Option.none<number>()
        );
      })
    );
    return yield* Stream.runCollect(pages);
  });

export const fetchCommitCandidates = (octokit: Octokit) =>
  Effect.gen(function* () {
    const searchCandidates = yield* searchRecentCommits(octokit);
    const scan = yield* scanRepositories(octokit);
    const bySha = new Map<string, CommitCandidate>();
    for (const candidate of [...searchCandidates, ...scan.candidates]) {
      if (!bySha.has(candidate.sha)) bySha.set(candidate.sha, candidate);
    }
    return {
      candidates: [...bySha.values()],
      failures: scan.failures,
      scanned: scan.scanned,
    } satisfies FetchedCommits;
  });

const makeCommitHydrator = (octokit: Octokit) => {
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

  return async (candidate: CommitCandidate): Promise<Option.Option<HydratedCommit>> => {
    const repository = await getRepositoryData(candidate.repoOwner, candidate.repoName);
    if (repository.fork && new Date(candidate.authoredAt) < new Date(repository.created_at)) {
      return Option.none();
    }
    const detail = await octokit.rest.repos.getCommit({
      owner: candidate.repoOwner,
      repo: candidate.repoName,
      ref: candidate.sha,
    });
    return Option.some({ candidate, repository, detail: detail.data });
  };
};

const makeCommitPersister = (integrationRunId: number) => {
  const ensureRepositoryExists = async (repository: GithubRepository): Promise<number> => {
    await ensureGithubUserExists(repository.owner, integrationRunId);
    const newRepo: GithubRepositoryInsert = {
      id: toGithubId(repository.id),
      nodeId: repository.node_id,
      name: repository.name,
      fullName: repository.full_name,
      ownerId: toGithubId(repository.owner.id),
      private: repository.private,
      htmlUrl: repository.html_url,
      homepageUrl: repository.homepage,
      licenseName: repository.license?.name,
      description: repository.description,
      language: repository.language,
      topics: repository.topics,
      integrationRunId,
      contentCreatedAt: new Date(repository.created_at),
      contentUpdatedAt: new Date(repository.updated_at),
    };
    await db
      .insert(githubRepositories)
      .values(newRepo)
      .onConflictDoUpdate({
        target: githubRepositories.id,
        set: { ...newRepo, recordUpdatedAt: new Date() },
      });
    return toGithubId(repository.id);
  };

  const ensuredRepositories = new Map<number, Promise<number>>();
  const ensureRepositoryOnce = (repository: GithubRepository): Promise<number> => {
    const repositoryId = toGithubId(repository.id);
    let ensured = ensuredRepositories.get(repositoryId);
    if (!ensured) {
      ensured = ensureRepositoryExists(repository);
      ensuredRepositories.set(repositoryId, ensured);
    }
    return ensured;
  };

  return async ({ candidate, repository, detail }: HydratedCommit): Promise<void> => {
    await ensureRepositoryOnce(repository);
    const newCommit: GithubCommitInsert = {
      id: candidate.nodeId,
      sha: candidate.sha,
      message: candidate.message,
      htmlUrl: candidate.htmlUrl,
      repositoryId: toGithubId(repository.id),
      committedAt: candidate.committedAt ? new Date(candidate.committedAt) : null,
      contentCreatedAt: new Date(candidate.authoredAt),
      integrationRunId,
      changes: detail.stats?.total ?? null,
      additions: detail.stats?.additions ?? null,
      deletions: detail.stats?.deletions ?? null,
    };
    await db.insert(githubCommits).values(newCommit);
    const files = detail.files ?? [];
    if (files.length > 0) {
      const newChanges: Array<GithubCommitChangeInsert> = files.map((file) => ({
        filename: file.filename,
        status: file.status,
        patch: file.patch ? file.patch.slice(0, MAX_PATCH_LENGTH) : '',
        commitId: candidate.nodeId,
        changes: file.changes,
        additions: file.additions,
        deletions: file.deletions,
      }));
      await db.insert(githubCommitChanges).values(newChanges);
    }
  };
};

export const hydrateCommits = (octokit: Octokit, candidates: ReadonlyArray<CommitCandidate>) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const sink = yield* DebugSink;
    const existingShas = new Set<string>();
    for (const chunk of Arr.chunksOf(
      candidates.map((candidate) => candidate.sha),
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
    const newCandidates = candidates.filter((candidate) => !existingShas.has(candidate.sha));
    yield* Effect.logInfo(
      `Processing ${newCandidates.length} new commits (${existingShas.size} already exist)`
    );
    if (newCandidates.length === 0) {
      return {
        candidateCount: 0,
        commits: [],
        failures: [],
        settledShas: existingShas,
      } satisfies CommitHydration;
    }
    const hydrateItem = makeCommitHydrator(octokit);
    const results = yield* forEachCollect(newCandidates, {
      concurrency: COMMIT_CONCURRENCY,
      label: (candidate) => `${candidate.repoFullName}@${candidate.sha.slice(0, 7)}`,
      worker: (candidate) =>
        Effect.tryPromise({
          try: () => hydrateItem(candidate),
          catch: (cause) =>
            new ApiRequestError({ resource: `github commit ${candidate.sha.slice(0, 7)}`, cause }),
        }).pipe(Effect.map((hydrated) => ({ candidate, hydrated }))),
    });
    const commits = Arr.getSomes(results.successes.map((result) => result.hydrated));
    const skippedShas = results.successes
      .filter((result) => Option.isNone(result.hydrated))
      .map((result) => result.candidate.sha);
    for (const { repository, detail } of commits) {
      yield* sink.capture({ repository, commit: detail });
    }
    yield* Effect.logInfo(`Hydrated ${commits.length} of ${newCandidates.length} commits`);
    return {
      candidateCount: newCandidates.length,
      commits,
      failures: results.failures,
      settledShas: new Set([...existingShas, ...skippedShas]),
    } satisfies CommitHydration;
  });

export const persistCommits = (hydration: CommitHydration, runId: number) =>
  Effect.gen(function* () {
    const persistCommit = makeCommitPersister(runId);
    const results = yield* forEachCollect(hydration.commits, {
      concurrency: COMMIT_CONCURRENCY,
      label: ({ candidate }) => `${candidate.repoFullName}@${candidate.sha.slice(0, 7)}`,
      worker: (commit) =>
        Effect.tryPromise({
          try: () => persistCommit(commit),
          catch: (cause) =>
            new ApiRequestError({
              resource: `github commit ${commit.candidate.sha.slice(0, 7)}`,
              cause,
            }),
        }).pipe(Effect.as(commit.candidate.sha)),
    });
    yield* Effect.logInfo(
      `Inserted ${results.successes.length} of ${hydration.candidateCount} commits`
    );
    return {
      entriesCreated: results.successes.length,
      failures: [...hydration.failures, ...results.failures],
      persistedShas: results.successes,
    } satisfies CommitPersistence;
  });
