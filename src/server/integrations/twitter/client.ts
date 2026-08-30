import { randomBytes, randomUUID } from 'node:crypto';
import { Config, Effect, Redacted, Result } from 'effect';
import { HttpClient } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError, describeError } from '../runtime/errors';
import { decodeZod } from '../runtime/zod';
import { buildBookmarksFeatures, buildTweetDetailFeatures } from './features';
import {
  extractTweetId,
  RawBookmarksApiResponseSchema,
  TimelineItemSchema,
  TweetDetailEnvelopeSchema,
  type TimelineItem,
} from './types';

const BEARER_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const TWITTER_API_BASE = 'https://x.com/i/api/graphql';

const QUERY_IDS = {
  Bookmarks: ['RV1g3b8n_SGOHwkqKYSCFw', 'tmd4ifV8RHltzn8ymGg1aw'],
  TweetDetail: ['97JF30KziU00483E_8elBA', '_NvJCnIjOW__EP5-RF197A'],
} as const;

const PAGE_SIZE = 20;
const REQUEST_TIMEOUT = '30 seconds';
const MAX_RATE_LIMIT_RETRIES = 2;

const decodeBookmarksResponse = decodeZod(RawBookmarksApiResponseSchema, 'twitter bookmarks');
const decodeTweetDetailResponse = decodeZod(TweetDetailEnvelopeSchema, 'twitter tweet detail');

const cookieConfig = (name: string, cookie: string) =>
  Config.redacted(name).pipe(
    Effect.catch(() =>
      Effect.fail(
        new ApiRequestError({
          resource: 'twitter credentials',
          cause: new Error(
            `Missing ${name} environment variable. Get this from browser DevTools → Application → Cookies → x.com → ${cookie}`
          ),
        })
      )
    )
  );

export interface BookmarksPage {
  readonly items: ReadonlyArray<TimelineItem>;
  readonly nextCursor: string | undefined;
}

type AttemptOutcome =
  | { readonly kind: 'json'; readonly json: unknown }
  | { readonly kind: 'advance'; readonly reason: string }
  | { readonly kind: 'fatal'; readonly error: ApiRequestError };

const parseTimelineItems = (
  rawResults: ReadonlyArray<unknown>
): Effect.Effect<Array<TimelineItem>> =>
  Effect.gen(function* () {
    const items: Array<TimelineItem> = [];
    for (const rawResult of rawResults) {
      const parsed = TimelineItemSchema.safeParse(rawResult);
      if (parsed.success) {
        items.push(parsed.data);
      } else {
        const typename =
          typeof rawResult === 'object' && rawResult !== null && '__typename' in rawResult
            ? String(rawResult.__typename)
            : 'unknown';
        yield* Effect.logWarning(
          `Failed to parse tweet result (${typename}): ${parsed.error.message}`
        );
      }
    }
    return items;
  });

export const twitterClient = Effect.gen(function* () {
  const authToken = yield* cookieConfig('TWITTER_AUTH_TOKEN', 'auth_token');
  const ct0 = yield* cookieConfig('TWITTER_CT0', 'ct0');
  const limiter = yield* RateLimiter.RateLimiter;
  const http = HttpClient.withRateLimiter(yield* HttpClient.HttpClient, {
    limiter,
    key: 'twitter',
    limit: 120,
    window: '1 minute',
    times: MAX_RATE_LIMIT_RETRIES,
  });
  const clientUuid = randomUUID();
  const baseHeaders = {
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    authorization: `Bearer ${BEARER_TOKEN}`,
    'x-csrf-token': Redacted.value(ct0),
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    'x-client-uuid': clientUuid,
    cookie: `auth_token=${Redacted.value(authToken)}; ct0=${Redacted.value(ct0)}`,
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    origin: 'https://x.com',
    referer: 'https://x.com/',
    'content-type': 'application/json',
  };

  const attempt = (url: string): Effect.Effect<AttemptOutcome> =>
    Effect.gen(function* () {
      const headers = {
        ...baseHeaders,
        'x-client-transaction-id': randomBytes(16).toString('hex'),
      };
      const result = yield* http
        .get(url, { headers })
        .pipe(Effect.timeout(REQUEST_TIMEOUT), Effect.result);
      if (Result.isFailure(result)) {
        return { kind: 'advance', reason: describeError(result.failure) } as const;
      }
      const response = result.success;
      if (response.status === 404) {
        return { kind: 'advance', reason: 'HTTP 404' } as const;
      }
      if (response.status < 200 || response.status >= 300) {
        const text = yield* response.text.pipe(Effect.catch(() => Effect.succeed('')));
        return {
          kind: 'fatal',
          error: new ApiRequestError({
            resource: url,
            cause: new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`),
          }),
        } as const;
      }
      const json = yield* response.json.pipe(Effect.result);
      if (Result.isFailure(json)) {
        return { kind: 'advance', reason: describeError(json.failure) } as const;
      }
      return { kind: 'json', json: json.success } as const;
    });

  const requestJson = (operation: keyof typeof QUERY_IDS, params: URLSearchParams) =>
    Effect.gen(function* () {
      let lastReason = 'no query IDs configured';
      for (const queryId of QUERY_IDS[operation]) {
        const outcome = yield* attempt(
          `${TWITTER_API_BASE}/${queryId}/${operation}?${params.toString()}`
        );
        if (outcome.kind === 'json') return outcome.json;
        if (outcome.kind === 'fatal') return yield* Effect.fail(outcome.error);
        lastReason = outcome.reason;
        yield* Effect.logWarning(
          `${operation} queryId=${queryId} failed (${outcome.reason}), advancing to next query ID`
        );
      }
      return yield* Effect.fail(
        new ApiRequestError({ resource: `twitter ${operation}`, cause: new Error(lastReason) })
      );
    });

  const fetchBookmarksPage = (cursor: string | undefined) =>
    Effect.gen(function* () {
      const variables = {
        count: PAGE_SIZE,
        includePromotedContent: false,
        withDownvotePerspective: false,
        withReactionsMetadata: false,
        withReactionsPerspective: false,
        ...(cursor ? { cursor } : {}),
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(buildBookmarksFeatures()),
      });
      const json = yield* requestJson('Bookmarks', params);
      const sink = yield* DebugSink;
      yield* sink.capture(json);
      const data = yield* decodeBookmarksResponse(json);
      const instructions = data.data?.bookmark_timeline_v2?.timeline?.instructions ?? [];
      if (data.errors && data.errors.length > 0) {
        const message = data.errors.map((error) => error.message).join(', ');
        if (instructions.length === 0) {
          return yield* Effect.fail(
            new ApiRequestError({ resource: 'twitter bookmarks', cause: new Error(message) })
          );
        }
        yield* Effect.logWarning(`GraphQL errors (non-fatal): ${message}`);
      }
      let nextCursor: string | undefined;
      const rawResults: Array<unknown> = [];
      for (const instruction of instructions) {
        for (const entry of instruction.entries ?? []) {
          if (entry.content.cursorType === 'Bottom' && entry.content.value) {
            nextCursor = entry.content.value;
          }
          const rawResult = entry.content.itemContent?.tweet_results?.result;
          if (rawResult !== undefined) rawResults.push(rawResult);
        }
      }
      const items = yield* parseTimelineItems(rawResults);
      return { items, nextCursor } satisfies BookmarksPage;
    });

  const fetchTweetById = (tweetId: string) =>
    Effect.gen(function* () {
      const variables = {
        focalTweetId: tweetId,
        with_rux_injections: false,
        rankingMode: 'Relevance',
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      };
      const features = {
        ...buildTweetDetailFeatures(),
        articles_preview_enabled: true,
        articles_rest_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        rweb_video_timestamps_enabled: true,
      };
      const fieldToggles = {
        withPayments: false,
        withAuxiliaryUserLabels: false,
        withArticleRichContentState: true,
        withArticlePlainText: true,
        withGrokAnalyze: false,
        withDisallowedReplyControls: false,
      };
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify(fieldToggles),
      });
      const json = yield* requestJson('TweetDetail', params);
      const sink = yield* DebugSink;
      yield* sink.capture(json);
      const envelope = yield* decodeTweetDetailResponse(json);
      const hasData =
        envelope.data?.tweetResult?.result !== undefined ||
        (envelope.data?.threaded_conversation_with_injections_v2?.instructions?.length ?? 0) > 0;
      if (envelope.errors && envelope.errors.length > 0) {
        const message = envelope.errors.map((error) => error.message).join(', ');
        if (!hasData) {
          return yield* Effect.fail(
            new ApiRequestError({
              resource: `twitter tweet ${tweetId}`,
              cause: new Error(message),
            })
          );
        }
        yield* Effect.logWarning(`GraphQL errors (non-fatal): ${message}`);
      }
      const candidates: Array<unknown> = [];
      if (envelope.data?.tweetResult?.result !== undefined) {
        candidates.push(envelope.data.tweetResult.result);
      }
      for (const instruction of envelope.data?.threaded_conversation_with_injections_v2
        ?.instructions ?? []) {
        for (const entry of instruction.entries ?? []) {
          const rawResult = entry.content?.itemContent?.tweet_results?.result;
          if (rawResult !== undefined) candidates.push(rawResult);
        }
      }
      const items = yield* parseTimelineItems(candidates);
      const item = items.find((candidate) => extractTweetId(candidate) === tweetId);
      if (!item) {
        return yield* Effect.fail(
          new ApiRequestError({
            resource: `twitter tweet ${tweetId}`,
            cause: new Error('Tweet not found in response'),
          })
        );
      }
      return item;
    });

  return { fetchBookmarksPage, fetchTweetById };
});
