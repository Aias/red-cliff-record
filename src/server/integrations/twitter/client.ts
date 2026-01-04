/**
 * Twitter GraphQL API client for fetching bookmarks.
 *
 * Uses cookie-based authentication and Twitter's undocumented GraphQL API.
 * Based on patterns from https://github.com/steipete/bird
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { type TwitterCredentials, getCredentials } from './auth';
import { buildBookmarksFeatures } from './features';
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
} as const;

// Additional fallback query IDs to try on 404
const FALLBACK_QUERY_IDS = {
	Bookmarks: ['tmd4ifV8RHltzn8ymGg1aw'],
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
}

/**
 * Creates a new Twitter client instance.
 */
export function createTwitterClient(options?: { timeoutMs?: number }): TwitterClient {
	return new TwitterClient(options);
}
