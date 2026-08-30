import { githubUsers, type GithubUserInsert } from '@hozo';
import type { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { db } from '@/server/db/connections/postgres';
import { Database } from '../runtime/db';
import { ApiRequestError } from '../runtime/errors';
import { forEachCollect, type ItemFailure } from '../runtime/run';
import { toGithubId } from './types';

const USER_CONCURRENCY = 10;

export async function ensureGithubUserExists(
  userData: {
    id: number | bigint;
    login: string;
    node_id: string;
    html_url: string;
    avatar_url: string;
    type: string;
  },
  integrationRunId: number
): Promise<number> {
  const user: GithubUserInsert = {
    id: toGithubId(userData.id),
    login: userData.login,
    nodeId: userData.node_id,
    htmlUrl: userData.html_url,
    avatarUrl: userData.avatar_url,
    type: userData.type,
    partial: true,
    integrationRunId,
  };
  await db
    .insert(githubUsers)
    .values(user)
    .onConflictDoUpdate({
      target: githubUsers.id,
      set: {
        ...user,
        recordUpdatedAt: new Date(),
      },
    });
  return toGithubId(userData.id);
}

export const updatePartialUsers = (octokit: Octokit) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const partialUsers = yield* database.use('githubUsers.partial', (client) =>
      client.query.githubUsers.findMany({
        where: { partial: true, deletedAt: { isNull: true } },
      })
    );
    yield* Effect.logInfo(`Found ${partialUsers.length} partial users to update`);
    if (partialUsers.length === 0) {
      return { updated: 0, failures: [] as Array<ItemFailure> };
    }
    const results = yield* forEachCollect(partialUsers, {
      concurrency: USER_CONCURRENCY,
      label: (user) => user.login,
      worker: (user) =>
        Effect.gen(function* () {
          const response = yield* Effect.tryPromise({
            try: () =>
              octokit.rest.users.getByUsername({
                username: user.login,
                headers: { 'X-GitHub-Api-Version': '2022-11-28' },
              }),
            catch: (cause) => new ApiRequestError({ resource: `github user ${user.login}`, cause }),
          });
          const userData = response.data;
          yield* database.use(`githubUsers.update:${user.login}`, (client) =>
            client
              .update(githubUsers)
              .set({
                name: userData.name,
                company: userData.company,
                blog: userData.blog,
                location: userData.location,
                email: userData.email,
                bio: userData.bio,
                twitterUsername: userData.twitter_username,
                followers: userData.followers,
                following: userData.following,
                contentCreatedAt: new Date(userData.created_at),
                contentUpdatedAt: new Date(userData.updated_at),
                partial: false,
                recordUpdatedAt: new Date(),
              })
              .where(eq(githubUsers.id, user.id))
          );
        }),
    });
    yield* Effect.logInfo(`Updated ${results.successes.length} users with full information`);
    return { updated: results.successes.length, failures: results.failures };
  });
