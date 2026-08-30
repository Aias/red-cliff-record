import { githubRepositories, type GithubRepositoryInsert } from '@hozo';
import type { Octokit } from '@octokit/rest';
import { Effect, Option, Stream } from 'effect';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError, DbError } from '../runtime/errors';
import { forEachCollect, type SyncSummary } from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import { ensureGithubUserExists } from './sync-users';
import { GithubStarredReposResponseSchema, type StarredRepo } from './types';

const PAGE_SIZE = 100;
const DB_CONCURRENCY = 10;

const decodeStarsPage = decodeZod(GithubStarredReposResponseSchema, 'github starred repos');

const getMostRecentStarredAt = Effect.gen(function* () {
  const database = yield* Database;
  const result = yield* database.use('githubRepositories.lastStarredAt', (client) =>
    client.query.githubRepositories.findFirst({
      columns: { starredAt: true },
      where: { starredAt: { isNotNull: true }, deletedAt: { isNull: true } },
      orderBy: { starredAt: 'desc' },
    })
  );
  yield* Effect.logInfo(
    `Most recent star in database: ${result?.starredAt?.toISOString() ?? 'none'}`
  );
  return result?.starredAt ?? null;
});

export const fetchNewStars = (octokit: Octokit) =>
  Effect.gen(function* () {
    const sink = yield* DebugSink;
    const mostRecentStarredAt = yield* getMostRecentStarredAt;
    const pages = Stream.paginate(1, (page: number) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            octokit.rest.activity.listReposStarredByAuthenticatedUser({
              mediaType: { format: 'vnd.github.star+json' },
              per_page: PAGE_SIZE,
              page,
            }),
          catch: (cause) => new ApiRequestError({ resource: `github stars page ${page}`, cause }),
        });
        yield* sink.capture(response.data);
        const parsed = yield* decodeStarsPage(response);
        const stars = parsed.data;
        yield* Effect.logInfo(`Retrieved ${stars.length} stars (page ${page})`);
        const newStars = stars.filter(
          (star) => !mostRecentStarredAt || star.starred_at > mostRecentStarredAt
        );
        const reachedExisting = newStars.length < stars.length;
        const hasMore = stars.length === PAGE_SIZE && !reachedExisting;
        return [newStars, hasMore ? Option.some(page + 1) : Option.none<number>()] as const;
      })
    );
    return yield* Stream.runCollect(pages);
  });

export const persistStars = (stars: ReadonlyArray<StarredRepo>, runId: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const ownersById = new Map<number, StarredRepo['repo']['owner']>();
    for (const star of stars) {
      ownersById.set(star.repo.owner.id, star.repo.owner);
    }
    const ownerResults = yield* forEachCollect([...ownersById.values()], {
      concurrency: DB_CONCURRENCY,
      label: (owner) => owner.login,
      worker: (owner) =>
        Effect.tryPromise({
          try: () => ensureGithubUserExists(owner, runId),
          catch: (cause) => new DbError({ operation: `githubUsers.ensure:${owner.login}`, cause }),
        }),
    });
    const starResults = yield* forEachCollect(stars, {
      concurrency: DB_CONCURRENCY,
      label: (star) => star.repo.full_name,
      worker: (star) => {
        const { repo, starred_at } = star;
        const newRepo: GithubRepositoryInsert = {
          id: repo.id,
          nodeId: repo.node_id,
          name: repo.name,
          fullName: repo.full_name,
          ownerId: repo.owner.id,
          private: repo.private,
          htmlUrl: repo.html_url,
          homepageUrl: repo.homepage,
          licenseName: repo.license?.name,
          description: repo.description,
          language: repo.language,
          topics: repo.topics.length > 0 ? repo.topics : null,
          starredAt: starred_at,
          contentCreatedAt: repo.created_at,
          contentUpdatedAt: repo.updated_at,
          integrationRunId: runId,
        };
        return database.use(`githubRepositories.upsert:${repo.id}`, (client) =>
          client
            .insert(githubRepositories)
            .values(newRepo)
            .onConflictDoUpdate({
              target: githubRepositories.id,
              set: { ...newRepo, recordUpdatedAt: new Date() },
            })
        );
      },
    });
    yield* Effect.logInfo(
      `Upserted ${starResults.successes.length} of ${stars.length} starred repositories`
    );
    return {
      entriesCreated: starResults.successes.length,
      failures: [...ownerResults.failures, ...starResults.failures],
    } satisfies SyncSummary;
  });
