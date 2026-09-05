import { githubCommits, githubRepositories } from '@hozo';
import type { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { eq } from 'drizzle-orm';
import { Array as Arr, Effect, Option } from 'effect';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError } from '../runtime/errors';
import { forEachCollect, type ItemFailure } from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import {
  RepositoryHeadsResponseSchema,
  toGithubId,
  type CommitCandidate,
  type RepositoryHead,
} from './types';

type CommitListItem = Endpoints['GET /repos/{owner}/{repo}/commits']['response']['data'][number];
type Comparison = Endpoints['GET /repos/{owner}/{repo}/compare/{basehead}']['response']['data'];

interface ScannableRepository {
  readonly id: number;
  readonly nodeId: string;
  readonly fullName: string;
}

interface RepositoryScan {
  readonly repository: ScannableRepository;
  readonly head: RepositoryHead;
  readonly headSha: string;
  readonly baseSha: string | null;
}

export interface ScannedRepository {
  readonly repositoryId: number;
  readonly headSha: string;
  readonly shas: ReadonlyArray<string>;
}

export interface RepositoryScanResult {
  readonly candidates: ReadonlyArray<CommitCandidate>;
  readonly failures: ReadonlyArray<ItemFailure>;
  readonly scanned: ReadonlyArray<ScannedRepository>;
}

const DB_CONCURRENCY = 10;
const HEAD_QUERY_CONCURRENCY = 4;
const NODE_ID_CHUNK_SIZE = 25;
const PER_PAGE = 100;
const REPO_CONCURRENCY = 4;

const REPOSITORY_HEADS_QUERY = `query($ids: [ID!]!) {
  viewer { login }
  nodes(ids: $ids) {
    ... on Repository {
      name
      owner { login }
      nameWithOwner
      defaultBranchRef { target { oid } }
    }
  }
}`;

const decodeRepositoryHeads = decodeZod(RepositoryHeadsResponseSchema, 'github repository heads');

const emptyScan = { candidates: [], failures: [], scanned: [] } satisfies RepositoryScanResult;

const fromListItem = (
  repository: RepositoryHead,
  item: CommitListItem
): Option.Option<CommitCandidate> => {
  const authoredAt = item.commit.author?.date ?? item.commit.committer?.date;
  if (!authoredAt) return Option.none();
  return Option.some({
    sha: item.sha,
    nodeId: item.node_id,
    htmlUrl: item.html_url,
    message: item.commit.message,
    authoredAt,
    committedAt: item.commit.committer?.date ?? null,
    repoOwner: repository.owner.login,
    repoName: repository.name,
    repoFullName: repository.nameWithOwner,
  });
};

const fetchOwnedRepositories = (octokit: Octokit) =>
  Effect.tryPromise({
    try: () =>
      octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        affiliation: 'owner',
        per_page: PER_PAGE,
      }),
    catch: (cause) => new ApiRequestError({ resource: 'github owned repositories', cause }),
  }).pipe(
    Effect.map((repositories) =>
      repositories.map((repository): ScannableRepository => ({
        id: toGithubId(repository.id),
        nodeId: repository.node_id,
        fullName: repository.full_name,
      }))
    )
  );

const fetchCommittedRepositories = Effect.gen(function* () {
  const database = yield* Database;
  return yield* database.use('githubRepositories.withCommits', (client) =>
    client
      .selectDistinct({
        id: githubRepositories.id,
        nodeId: githubRepositories.nodeId,
        fullName: githubRepositories.fullName,
      })
      .from(githubRepositories)
      .innerJoin(githubCommits, eq(githubCommits.repositoryId, githubRepositories.id))
  );
});

const fetchScannableRepositories = (octokit: Octokit) =>
  Effect.gen(function* () {
    const [owned, committed] = yield* Effect.all(
      [fetchOwnedRepositories(octokit), fetchCommittedRepositories],
      { concurrency: 2 }
    );
    const byId = new Map<number, ScannableRepository>();
    for (const repository of [...owned, ...committed]) {
      byId.set(repository.id, repository);
    }
    return [...byId.values()];
  });

const fetchSyncedHeads = (repositories: ReadonlyArray<ScannableRepository>) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.use('githubRepositories.syncedHeads', (client) =>
      client.query.githubRepositories.findMany({
        columns: { id: true, syncedHeadSha: true },
        where: { id: { in: repositories.map((repository) => repository.id) } },
      })
    );
    return new Map(rows.map((row) => [row.id, row.syncedHeadSha]));
  });

const partialGraphqlData = (error: unknown): Option.Option<unknown> =>
  typeof error === 'object' && error !== null && 'errors' in error && 'data' in error
    ? Option.some(error.data)
    : Option.none();

const queryRepositoryHeads = (octokit: Octokit, ids: ReadonlyArray<string>) =>
  Effect.tryPromise({
    try: () => octokit.graphql(REPOSITORY_HEADS_QUERY, { ids }),
    catch: (cause) => cause,
  }).pipe(
    Effect.catch((cause) =>
      Option.match(partialGraphqlData(cause), {
        onNone: () =>
          Effect.fail(new ApiRequestError({ resource: 'github repository heads', cause })),
        onSome: Effect.succeed,
      })
    ),
    Effect.flatMap(decodeRepositoryHeads)
  );

const resolveRepositoryHeads = (
  octokit: Octokit,
  repositories: ReadonlyArray<ScannableRepository>
) =>
  Effect.gen(function* () {
    const sink = yield* DebugSink;
    const pages = yield* Effect.forEach(
      Arr.chunksOf(repositories, NODE_ID_CHUNK_SIZE),
      (chunk) =>
        Effect.gen(function* () {
          const response = yield* queryRepositoryHeads(
            octokit,
            chunk.map((repository) => repository.nodeId)
          );
          yield* sink.capture(response);
          return { login: response.viewer.login, heads: Arr.zip(chunk, response.nodes) };
        }),
      { concurrency: HEAD_QUERY_CONCURRENCY }
    );
    return Option.map(Arr.head(pages), (first) => ({
      login: first.login,
      heads: pages.flatMap((page) => page.heads),
    }));
  });

const planScan = (
  repository: ScannableRepository,
  head: RepositoryHead | null,
  syncedHeadSha: string | null
): Option.Option<RepositoryScan> => {
  const headSha = head?.defaultBranchRef?.target?.oid;
  if (!head || !headSha || headSha === syncedHeadSha) return Option.none();
  return Option.some({ repository, head, headSha, baseSha: syncedHeadSha });
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && error.status === 404;

const compareCommitsPage = async (
  octokit: Octokit,
  head: RepositoryHead,
  basehead: string,
  page: number
): Promise<Option.Option<Comparison>> => {
  try {
    const response = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: head.owner.login,
      repo: head.name,
      basehead,
      per_page: PER_PAGE,
      page,
    });
    return Option.some(response.data);
  } catch (error) {
    if (isNotFound(error)) return Option.none();
    throw error;
  }
};

const listCommitsSince = async (
  octokit: Octokit,
  scan: RepositoryScan,
  baseSha: string
): Promise<Option.Option<Array<CommitListItem>>> => {
  const basehead = `${baseSha}...${scan.headSha}`;
  const commits: Array<CommitListItem> = [];
  for (let page = 1; ; page += 1) {
    const comparison = await compareCommitsPage(octokit, scan.head, basehead, page);
    if (Option.isNone(comparison)) return Option.none();
    commits.push(...comparison.value.commits);
    if (page * PER_PAGE >= comparison.value.total_commits) return Option.some(commits);
  }
};

const listAuthoredCommits = (
  octokit: Octokit,
  head: RepositoryHead,
  login: string
): Promise<Array<CommitListItem>> =>
  octokit.paginate(octokit.rest.repos.listCommits, {
    owner: head.owner.login,
    repo: head.name,
    author: login,
    per_page: PER_PAGE,
  });

const fetchScanItems = async (
  octokit: Octokit,
  login: string,
  scan: RepositoryScan
): Promise<Array<CommitListItem>> => {
  if (scan.baseSha !== null) {
    const delta = await listCommitsSince(octokit, scan, scan.baseSha);
    if (Option.isSome(delta)) return delta.value.filter((item) => item.author?.login === login);
  }
  return listAuthoredCommits(octokit, scan.head, login);
};

const scanRepository = (octokit: Octokit, login: string, scan: RepositoryScan) =>
  Effect.gen(function* () {
    const sink = yield* DebugSink;
    const items = yield* Effect.tryPromise({
      try: () => fetchScanItems(octokit, login, scan),
      catch: (cause) =>
        new ApiRequestError({ resource: `github repository ${scan.head.nameWithOwner}`, cause }),
    });
    yield* sink.capture(items);
    const candidates = Arr.getSomes(items.map((item) => fromListItem(scan.head, item)));
    return { scan, candidates };
  });

export const scanRepositories = (octokit: Octokit) =>
  Effect.gen(function* () {
    const repositories = yield* fetchScannableRepositories(octokit);
    const resolved = yield* resolveRepositoryHeads(octokit, repositories);
    if (Option.isNone(resolved)) return emptyScan;
    const { login, heads } = resolved.value;
    const syncedHeads = yield* fetchSyncedHeads(repositories);
    const unavailable = heads.filter(([, head]) => head === null).length;
    const scans = Arr.getSomes(
      heads.map(([repository, head]) =>
        planScan(repository, head, syncedHeads.get(repository.id) ?? null)
      )
    );
    const incremental = scans.filter((scan) => scan.baseSha !== null).length;
    yield* Effect.logInfo(
      `Resolved heads for ${heads.length} repositories: ${scans.length} to scan (${incremental} incremental), ${heads.length - scans.length - unavailable} unchanged, ${unavailable} unavailable`
    );
    const results = yield* forEachCollect(scans, {
      concurrency: REPO_CONCURRENCY,
      label: (scan) => scan.head.nameWithOwner,
      worker: (scan) => scanRepository(octokit, login, scan),
    });
    const candidates = results.successes.flatMap((result) => result.candidates);
    yield* Effect.logInfo(`Repository scan yielded ${candidates.length} commits`);
    return {
      candidates,
      failures: results.failures,
      scanned: results.successes.map((result) => ({
        repositoryId: result.scan.repository.id,
        headSha: result.scan.headSha,
        shas: result.candidates.map((candidate) => candidate.sha),
      })),
    } satisfies RepositoryScanResult;
  });

export const recordSyncedHeads = (
  scanned: ReadonlyArray<ScannedRepository>,
  settledShas: ReadonlySet<string>
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const completed = scanned.filter((scan) => scan.shas.every((sha) => settledShas.has(sha)));
    yield* Effect.forEach(
      completed,
      (scan) =>
        database.use(`githubRepositories.syncedHead:${scan.repositoryId}`, (client) =>
          client
            .update(githubRepositories)
            .set({ syncedHeadSha: scan.headSha })
            .where(eq(githubRepositories.id, scan.repositoryId))
        ),
      { concurrency: DB_CONCURRENCY, discard: true }
    );
    yield* Effect.logInfo(
      `Recorded synced heads for ${completed.length} of ${scanned.length} scanned repositories`
    );
  });
