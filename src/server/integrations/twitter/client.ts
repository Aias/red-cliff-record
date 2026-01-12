/**
 * Twitter GraphQL API client for fetching bookmarks.
 *
 * Uses cookie-based authentication and Twitter's undocumented GraphQL API.
 * Based on patterns from https://github.com/steipete/bird
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { type TwitterCredentials, getCredentials } from './auth';
import { buildBookmarksFeatures, buildTweetDetailFeatures } from './features';
import {
	type RawBookmarksApiResponse,
	RawBookmarksApiResponseSchema,
	TimelineItemSchema,
	type TwitterBookmarkResponse,
	type TwitterBookmarksArray,
	extractTweetId,
} from './types';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('twitter', 'client');

// Twitter's public web app bearer token (same for all users)
const BEARER_TOKEN =
	'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const TWITTER_API_BASE = 'https://x.com/i/api/graphql';

// Baseline query IDs - these rotate periodically
const QUERY_IDS = {
	Bookmarks: 'RV1g3b8n_SGOHwkqKYSCFw',
	TweetDetail: '97JF30KziU00483E_8elBA',
} as const;

// Additional fallback query IDs to try on 404
const FALLBACK_QUERY_IDS = {
	Bookmarks: ['tmd4ifV8RHltzn8ymGg1aw'],
	TweetDetail: ['_NvJCnIjOW__EP5-RF197A'],
} as const;

interface BookmarksPageResult {
	success: true;
	response: TwitterBookmarkResponse['response'];
	nextCursor?: string;
}

interface BookmarksPageError {
	success: false;
	error: string;
	is404?: boolean;
}

type BookmarksPageResponse = BookmarksPageResult | BookmarksPageError;

// Types for TweetDetail response
interface TweetDetailResult {
	success: true;
	/** Raw tweet data in the same format as bookmarks */
	tweetResult: unknown;
}

interface TweetDetailError {
	success: false;
	error: string;
}

type TweetDetailResponse = TweetDetailResult | TweetDetailError;

/**
 * Twitter GraphQL API client.
 */
export class TwitterClient {
	private credentials: TwitterCredentials;
	private clientUuid: string;
	private timeoutMs: number;

	constructor(options?: { timeoutMs?: number }) {
		this.credentials = getCredentials();
		this.clientUuid = randomUUID();
		this.timeoutMs = options?.timeoutMs ?? 30000;
	}

	/**
	 * Builds the headers required for Twitter API requests.
	 */
	private buildHeaders(): Record<string, string> {
		return {
			accept: '*/*',
			'accept-language': 'en-US,en;q=0.9',
			authorization: `Bearer ${BEARER_TOKEN}`,
			'x-csrf-token': this.credentials.ct0,
			'x-twitter-auth-type': 'OAuth2Session',
			'x-twitter-active-user': 'yes',
			'x-twitter-client-language': 'en',
			'x-client-uuid': this.clientUuid,
			'x-client-transaction-id': randomBytes(16).toString('hex'),
			cookie: this.credentials.cookieHeader,
			'user-agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			origin: 'https://x.com',
			referer: 'https://x.com/',
			'content-type': 'application/json',
		};
	}

	/**
	 * Fetches with timeout support.
	 */
	private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			return await fetch(url, { ...init, signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Fetches a single page of bookmarks.
	 */
	private async fetchBookmarksPage(cursor?: string, count = 20): Promise<BookmarksPageResponse> {
		const variables = {
			count,
			includePromotedContent: false,
			withDownvotePerspective: false,
			withReactionsMetadata: false,
			withReactionsPerspective: false,
			...(cursor ? { cursor } : {}),
		};

		const features = buildBookmarksFeatures();

		const params = new URLSearchParams({
			variables: JSON.stringify(variables),
			features: JSON.stringify(features),
		});

		// Try primary query ID, then fallbacks
		const queryIds = [QUERY_IDS.Bookmarks, ...FALLBACK_QUERY_IDS.Bookmarks];
		let lastError: string | undefined;
		let had404 = false;

		for (const queryId of queryIds) {
			const url = `${TWITTER_API_BASE}/${queryId}/Bookmarks?${params.toString()}`;

			try {
				logger.info(`Fetching bookmarks with queryId=${queryId}, cursor=${cursor ?? 'none'}`);
				const response = await this.fetchWithTimeout(url, {
					method: 'GET',
					headers: this.buildHeaders(),
				});

				if (response.status === 404) {
					had404 = true;
					lastError = `HTTP 404 for queryId=${queryId}`;
					logger.warn(lastError);
					continue;
				}

				if (!response.ok) {
					const text = await response.text();
					return {
						success: false,
						error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
						is404: false,
					};
				}

				const rawJson: unknown = await response.json();
				const parseResult = RawBookmarksApiResponseSchema.safeParse(rawJson);

				if (!parseResult.success) {
					logger.warn(`Failed to parse API response: ${parseResult.error.message}`);
					return {
						success: false,
						error: `Invalid API response format: ${parseResult.error.message}`,
						is404: false,
					};
				}

				const data: RawBookmarksApiResponse = parseResult.data;

				if (data.errors && data.errors.length > 0) {
					const errorMsg = data.errors.map((e) => e.message).join(', ');
					logger.warn(`GraphQL errors (non-fatal): ${errorMsg}`);
					// Continue if we still have data
					if (!data.data?.bookmark_timeline_v2?.timeline?.instructions) {
						return { success: false, error: errorMsg, is404: false };
					}
				}

				// Extract cursor for next page
				const instructions = data.data?.bookmark_timeline_v2?.timeline?.instructions ?? [];
				let nextCursor: string | undefined;

				for (const instruction of instructions) {
					for (const entry of instruction.entries ?? []) {
						const content = entry.content;
						if (content?.cursorType === 'Bottom' && content.value) {
							nextCursor = content.value;
						}
					}
				}

				// Return in the format expected by existing sync code
				return {
					success: true,
					response: {
						data: {
							bookmark_timeline_v2: {
								timeline: {
									instructions: instructions.map((inst) => ({
										type: inst.type ?? 'TimelineAddEntries',
										entries: (inst.entries ?? []).map((entry) => {
											const itemContent = entry.content?.itemContent;
											const rawResult = itemContent?.tweet_results?.result;

											// Parse the raw result through TimelineItemSchema for type safety
											const parsedResult = rawResult
												? TimelineItemSchema.safeParse(rawResult)
												: undefined;

											// Log parse failures for visibility into schema drift
											if (rawResult && parsedResult && !parsedResult.success) {
												const typename =
													typeof rawResult === 'object' &&
													rawResult !== null &&
													'__typename' in rawResult
														? String(rawResult.__typename)
														: 'unknown';
												logger.warn(
													`Failed to parse tweet result (${typename}): ${parsedResult.error.message}`
												);
											}

											// Only include itemContent if we successfully parsed tweet_results
											// This matches the type expectation that tweet_results is required when itemContent exists
											const validItemContent =
												itemContent && parsedResult?.success
													? {
															tweet_results: { result: parsedResult.data },
															itemType: itemContent.itemType,
															__typename: itemContent.__typename,
														}
													: undefined;

											return {
												entryId: entry.entryId,
												sortIndex: entry.sortIndex,
												content: {
													__typename: entry.content?.__typename ?? 'TimelineTimelineItem',
													entryType: entry.content?.entryType,
													itemContent: validItemContent,
												},
											};
										}),
									})),
								},
							},
						},
					},
					nextCursor,
				};
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				logger.error(`Request error for queryId=${queryId}`, error);
			}
		}

		return {
			success: false,
			error: lastError ?? 'Unknown error fetching bookmarks',
			is404: had404,
		};
	}

	/**
	 * Extracts tweet IDs from a bookmark response page.
	 */
	private extractTweetIdsFromPage(response: TwitterBookmarkResponse['response']): string[] {
		const ids: string[] = [];
		for (const instruction of response.data.bookmark_timeline_v2.timeline.instructions) {
			for (const entry of instruction.entries ?? []) {
				const result = entry.content?.itemContent?.tweet_results?.result;
				if (result) {
					const id = extractTweetId(result);
					if (id) {
						ids.push(id);
					}
				}
			}
		}
		return ids;
	}

	/**
	 * Fetches all bookmarks with pagination.
	 *
	 * @param options.maxPages - Maximum number of pages to fetch (default: unlimited)
	 * @param options.pageSize - Number of items per page (default: 20)
	 * @param options.knownTweetIds - Set of tweet IDs already in database; stops when encountered
	 * @returns Array of bookmark responses in the format expected by sync.ts
	 */
	async fetchAllBookmarks(options?: {
		maxPages?: number;
		pageSize?: number;
		knownTweetIds?: Set<string>;
	}): Promise<TwitterBookmarksArray> {
		const { maxPages, pageSize = 20, knownTweetIds } = options ?? {};
		const responses: TwitterBookmarksArray = [];
		let cursor: string | undefined;
		let pagesFetched = 0;

		while (true) {
			const result = await this.fetchBookmarksPage(cursor, pageSize);

			if (!result.success) {
				if (responses.length === 0) {
					throw new Error(`Failed to fetch bookmarks: ${result.error}`);
				}
				// If we have some data, log warning and return what we have
				logger.warn(`Stopping pagination due to error: ${result.error}`);
				break;
			}

			pagesFetched++;
			logger.info(
				`Fetched page ${pagesFetched}${maxPages ? `/${maxPages}` : ''}, cursor=${cursor ?? 'initial'}`
			);

			// Add to responses in the format expected by existing code
			responses.push({
				url: `https://x.com/i/api/graphql/Bookmarks?page=${pagesFetched}`,
				timestamp: new Date().toISOString(),
				response: result.response,
			});

			// Check if we've hit known tweets (incremental sync)
			if (knownTweetIds && knownTweetIds.size > 0) {
				const pageIds = this.extractTweetIdsFromPage(result.response);
				const foundKnown = pageIds.some((id) => knownTweetIds.has(id));
				if (foundKnown) {
					logger.info(`Found known tweet on page ${pagesFetched}, stopping pagination`);
					break;
				}
			}

			// Check stopping conditions
			if (!result.nextCursor) {
				logger.info('No more pages (no cursor returned)');
				break;
			}

			if (result.nextCursor === cursor) {
				logger.info('No more pages (cursor unchanged)');
				break;
			}

			if (maxPages && pagesFetched >= maxPages) {
				logger.info(`Reached max pages limit (${maxPages})`);
				break;
			}

			cursor = result.nextCursor;

			// Small delay between pages to be respectful
			await Bun.sleep(500);
		}

		logger.complete(`Fetched ${responses.length} pages of bookmarks`);
		return responses;
	}

	/**
	 * Fetches a single tweet by ID using the TweetDetail GraphQL endpoint.
	 *
	 * @param tweetId - The ID of the tweet to fetch
	 * @returns The raw tweet data in the same format as bookmarks, or an error
	 */
	async fetchTweetById(tweetId: string): Promise<TweetDetailResponse> {
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

		// Try primary query ID, then fallbacks
		const queryIds = [QUERY_IDS.TweetDetail, ...FALLBACK_QUERY_IDS.TweetDetail];
		let lastError: string | undefined;

		for (const queryId of queryIds) {
			const url = `${TWITTER_API_BASE}/${queryId}/TweetDetail?${params.toString()}`;

			try {
				logger.info(`Fetching tweet ${tweetId} with queryId=${queryId}`);
				const response = await this.fetchWithTimeout(url, {
					method: 'GET',
					headers: this.buildHeaders(),
				});

				if (response.status === 404) {
					lastError = `HTTP 404 for queryId=${queryId}`;
					logger.warn(lastError);
					continue;
				}

				if (!response.ok) {
					const text = await response.text();
					return {
						success: false,
						error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
					};
				}

				const data = (await response.json()) as {
					data?: {
						tweetResult?: { result?: unknown };
						threaded_conversation_with_injections_v2?: {
							instructions?: Array<{
								entries?: Array<{
									content?: {
										itemContent?: {
											tweet_results?: { result?: unknown };
										};
									};
								}>;
							}>;
						};
					};
					errors?: Array<{ message: string }>;
				};

				if (data.errors && data.errors.length > 0) {
					const errorMsg = data.errors.map((e) => e.message).join(', ');
					// Check if we still have usable data
					const hasData =
						data.data?.tweetResult?.result ||
						data.data?.threaded_conversation_with_injections_v2?.instructions?.length;
					if (!hasData) {
						return { success: false, error: errorMsg };
					}
					logger.warn(`GraphQL errors (non-fatal): ${errorMsg}`);
				}

				// Extract the tweet result - can be in tweetResult or threaded_conversation
				let tweetResult = data.data?.tweetResult?.result;

				// If not in tweetResult, find it in threaded_conversation
				if (!tweetResult) {
					const instructions = data.data?.threaded_conversation_with_injections_v2?.instructions;
					if (instructions) {
						for (const instruction of instructions) {
							for (const entry of instruction.entries ?? []) {
								const result = entry.content?.itemContent?.tweet_results?.result;
								if (result && typeof result === 'object' && 'rest_id' in result) {
									if ((result as { rest_id?: string }).rest_id === tweetId) {
										tweetResult = result;
										break;
									}
								}
							}
							if (tweetResult) break;
						}
					}
				}

				if (!tweetResult) {
					return { success: false, error: 'Tweet not found in response' };
				}

				return { success: true, tweetResult };
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				logger.error(`Request error for queryId=${queryId}`, error);
			}
		}

		return {
			success: false,
			error: lastError ?? 'Unknown error fetching tweet',
		};
	}
}

/**
 * Creates a new Twitter client instance.
 */
export function createTwitterClient(options?: { timeoutMs?: number }): TwitterClient {
	return new TwitterClient(options);
}
