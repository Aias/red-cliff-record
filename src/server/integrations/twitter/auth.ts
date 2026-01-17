/**
 * Twitter authentication using cookie-based auth for GraphQL API.
 *
 * Requires TWITTER_AUTH_TOKEN and TWITTER_CT0 environment variables,
 * which can be obtained from browser DevTools after logging into x.com.
 */

export interface TwitterCredentials {
  authToken: string;
  ct0: string;
  cookieHeader: string;
}

/**
 * Resolves Twitter credentials from environment variables.
 *
 * @throws Error if required environment variables are missing
 */
export function getCredentials(): TwitterCredentials {
  const authToken = process.env.TWITTER_AUTH_TOKEN;
  const ct0 = process.env.TWITTER_CT0;

  if (!authToken) {
    throw new Error(
      'Missing TWITTER_AUTH_TOKEN environment variable. ' +
        'Get this from browser DevTools → Application → Cookies → x.com → auth_token'
    );
  }

  if (!ct0) {
    throw new Error(
      'Missing TWITTER_CT0 environment variable. ' +
        'Get this from browser DevTools → Application → Cookies → x.com → ct0'
    );
  }

  return {
    authToken,
    ct0,
    cookieHeader: `auth_token=${authToken}; ct0=${ct0}`,
  };
}
