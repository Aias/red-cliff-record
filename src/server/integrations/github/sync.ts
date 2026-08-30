import type { Octokit } from '@octokit/rest';
import { Effect } from 'effect';
import { legacyOperation } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { requireRunId, type IntegrationDef, type SyncSummary } from '../runtime/run';
import { createRecordsFromGithubRepositories, createRecordsFromGithubUsers } from './map';
import { githubClient } from './octokit';
import { summarizeMissingCommits } from './summarize-commits';
import { fetchNewCommits, hydrateCommits, persistCommits } from './sync-commits';
import { fetchNewStars, persistStars } from './sync-stars';
import { updatePartialUsers } from './sync-users';

const reconcileGithubEntities = (octokit: Octokit) =>
  Effect.gen(function* () {
    const users = yield* updatePartialUsers(octokit);
    yield* legacyOperation('github.userRecords', () => createRecordsFromGithubUsers());
    yield* legacyOperation('github.repositoryRecords', () => createRecordsFromGithubRepositories());
    return users.failures;
  });

const starsSync = Effect.gen(function* () {
  const octokit = yield* githubClient;
  const stars = yield* fetchNewStars(octokit);
  yield* Effect.logInfo(`Fetched ${stars.length} new starred repositories`);
  const sink = yield* DebugSink;
  if (sink.enabled) {
    yield* Effect.logInfo('Debug mode: skipping database writes');
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  const runId = yield* requireRunId;
  const starSummary = yield* persistStars(stars, runId);
  const reconcileFailures = yield* reconcileGithubEntities(octokit);
  return {
    entriesCreated: starSummary.entriesCreated,
    failures: [...starSummary.failures, ...reconcileFailures],
  } satisfies SyncSummary;
});

const commitsSync = Effect.gen(function* () {
  const octokit = yield* githubClient;
  const items = yield* fetchNewCommits(octokit);
  yield* Effect.logInfo(`Fetched ${items.length} commits from search`);
  const hydration = yield* hydrateCommits(octokit, items);
  const sink = yield* DebugSink;
  if (sink.enabled) {
    yield* Effect.logInfo('Debug mode: skipping database writes');
    return { entriesCreated: 0, failures: hydration.failures } satisfies SyncSummary;
  }
  const runId = yield* requireRunId;
  const commitSummary = yield* persistCommits(hydration, runId);
  const summaries = yield* summarizeMissingCommits;
  const reconcileFailures = yield* reconcileGithubEntities(octokit);
  return {
    entriesCreated: commitSummary.entriesCreated,
    failures: [...commitSummary.failures, ...summaries.failures, ...reconcileFailures],
  } satisfies SyncSummary;
});

export const githubIntegration: IntegrationDef = {
  integrationType: 'github',
  sync: starsSync,
};

export const githubCommitsIntegration: IntegrationDef = {
  integrationType: 'github',
  sync: commitsSync,
};
