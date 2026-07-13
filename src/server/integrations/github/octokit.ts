import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('github', 'api');

const ThrottledOctokit = Octokit.plugin(throttling);

/**
 * Creates an authenticated Octokit client that respects GitHub's primary and
 * secondary rate limits reactively: throttled requests are retried after the
 * server-indicated delay instead of pacing every request with fixed sleeps.
 */
export function createGithubClient() {
  return new ThrottledOctokit({
    auth: process.env.GITHUB_TOKEN,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        logger.warn(
          `Rate limit hit for ${options.method} ${options.url}; retrying after ${retryAfter}s`
        );
        return retryCount < 2;
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        logger.warn(
          `Secondary rate limit hit for ${options.method} ${options.url}; retrying after ${retryAfter}s`
        );
        return retryCount < 2;
      },
    },
  });
}
