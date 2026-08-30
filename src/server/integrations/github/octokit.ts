import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import { Config, Effect, Redacted } from 'effect';

const ThrottledOctokit = Octokit.plugin(throttling);

const MAX_THROTTLE_RETRIES = 2;

export const githubClient = Effect.gen(function* () {
  const token = yield* Config.redacted('GITHUB_TOKEN');
  return new ThrottledOctokit({
    auth: Redacted.value(token),
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        console.warn(
          `GitHub rate limit for ${options.method} ${options.url}; retrying after ${retryAfter}s`
        );
        return retryCount < MAX_THROTTLE_RETRIES;
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        console.warn(
          `GitHub secondary rate limit for ${options.method} ${options.url}; retrying after ${retryAfter}s`
        );
        return retryCount < MAX_THROTTLE_RETRIES;
      },
    },
  });
});
