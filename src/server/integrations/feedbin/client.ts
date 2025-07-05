import { requireEnv } from '../common/env';
import { createIntegrationLogger } from '../common/logging';
import {
	FeedbinEntriesResponseSchema,
	FeedbinEntryIdsResponseSchema,
	FeedbinFeedSchema,
	FeedbinIconsResponseSchema,
	FeedbinSubscriptionsResponseSchema,
	parseLinkHeader,
	type FeedbinEntry,
	type FeedbinFeed,
	type FeedbinIcon,
	type FeedbinSubscription,
} from './types';

const API_BASE_URL = 'https://api.feedbin.com/v2';
const logger = createIntegrationLogger('feedbin', 'client');

/**
 * Create basic auth header for Feedbin API
 */
function createAuthHeader(): string {
	const username = requireEnv('FEEDBIN_USERNAME');
	const password = requireEnv('FEEDBIN_PASSWORD');
	const credentials = `${username}:${password}`;
	return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Make authenticated request to Feedbin API
 */
async function makeRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<{ data: T; headers: Headers }> {
	const url = `${API_BASE_URL}${endpoint}`;
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: createAuthHeader(),
			'Content-Type': 'application/json; charset=utf-8',
			...options.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Feedbin API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();
	return { data, headers: response.headers };
}

/**
 * Fetch all subscriptions (feeds) for the authenticated user
 * @param since Optional date to fetch only subscriptions created after this time
 */
export async function fetchSubscriptions(since?: Date): Promise<FeedbinSubscription[]> {
	logger.start('Fetching subscriptions');
	let endpoint = '/subscriptions.json';
	if (since) {
		// Add one second to since to avoid duplicate most recent feed
		const adjustedSince = new Date(since.getTime() + 1000);
		endpoint += `?since=${adjustedSince.toISOString()}`;
	}
	const { data } = await makeRequest<unknown>(endpoint);
	const subscriptions = FeedbinSubscriptionsResponseSchema.parse(data);
	logger.complete(`Fetched ${subscriptions.length} subscriptions`);
	return subscriptions;
}

/**
 * Fetch a single feed by ID
 */
export async function fetchFeed(feedId: number): Promise<FeedbinFeed> {
	logger.info(`Fetching feed ${feedId}`);
	const { data } = await makeRequest<unknown>(`/feeds/${feedId}.json`);
	return FeedbinFeedSchema.parse(data);
}

/**
 * Fetch unread entry IDs
 */
export async function fetchUnreadEntryIds(): Promise<number[]> {
	logger.start('Fetching unread entry IDs');
	const { data } = await makeRequest<unknown>('/unread_entries.json');
	const entryIds = FeedbinEntryIdsResponseSchema.parse(data);
	logger.complete(`Fetched ${entryIds.length} unread entry IDs`);
	return entryIds;
}

/**
 * Fetch starred entry IDs
 */
export async function fetchStarredEntryIds(): Promise<number[]> {
	logger.start('Fetching starred entry IDs');
	const { data } = await makeRequest<unknown>('/starred_entries.json');
	const entryIds = FeedbinEntryIdsResponseSchema.parse(data);
	logger.complete(`Fetched ${entryIds.length} starred entry IDs`);
	return entryIds;
}

/**
 * Fetch recently read entry IDs
 */
export async function fetchRecentlyReadEntryIds(): Promise<number[]> {
	logger.start('Fetching recently read entry IDs');
	const { data } = await makeRequest<unknown>('/recently_read_entries.json');
	const entryIds = FeedbinEntryIdsResponseSchema.parse(data);
	logger.complete(`Fetched ${entryIds.length} recently read entry IDs`);
	return entryIds;
}

/**
 * Fetch updated entry IDs (entries that have been modified after initial publication)
 * @param since Optional date to fetch only entries updated after this time
 */
export async function fetchUpdatedEntryIds(since?: Date): Promise<number[]> {
	logger.start('Fetching updated entry IDs');
	let endpoint = '/updated_entries.json';
	if (since) {
		endpoint += `?since=${since.toISOString()}`;
	}
	const { data } = await makeRequest<unknown>(endpoint);
	const entryIds = FeedbinEntryIdsResponseSchema.parse(data);
	logger.complete(`Fetched ${entryIds.length} updated entry IDs`);
	return entryIds;
}

/**
 * Fetch entries by IDs with pagination support
 * @param ids Array of entry IDs to fetch (max 100 per request)
 * @param includeEnclosure Whether to include podcast/media enclosure data
 */
export async function fetchEntriesByIds(
	ids: number[],
	includeEnclosure = true
): Promise<FeedbinEntry[]> {
	if (ids.length === 0) return [];

	const entries: FeedbinEntry[] = [];
	const batchSize = 100; // Feedbin API limit

	// Process in batches of 100
	for (let i = 0; i < ids.length; i += batchSize) {
		const batch = ids.slice(i, i + batchSize);
		const idsParam = batch.join(',');
		const endpoint = `/entries.json?ids=${idsParam}&mode=extended&include_enclosure=${includeEnclosure}`;

		logger.info(
			`Fetching entries ${i + 1}-${Math.min(i + batchSize, ids.length)} of ${ids.length}`
		);
		const { data } = await makeRequest<unknown>(endpoint);
		const batchEntries = FeedbinEntriesResponseSchema.parse(data);
		entries.push(...batchEntries);
	}

	logger.complete(`Fetched ${entries.length} entries`);
	return entries;
}

/**
 * Fetch all entries with pagination (for a specific feed or all feeds)
 * @param feedId Optional feed ID to fetch entries for
 * @param options Additional query parameters
 */
export async function fetchEntries(
	feedId?: number,
	options?: {
		since?: Date;
		read?: boolean;
		starred?: boolean;
		perPage?: number;
		includeEnclosure?: boolean;
	}
): Promise<FeedbinEntry[]> {
	const entries: FeedbinEntry[] = [];
	let page = 1;
	let hasNextPage = true;

	const params = new URLSearchParams({
		mode: 'extended',
		include_enclosure: String(options?.includeEnclosure ?? true),
		per_page: String(options?.perPage ?? 100),
	});

	if (options?.since) {
		params.set('since', options.since.toISOString());
	}
	if (options?.read !== undefined) {
		params.set('read', String(options.read));
	}
	if (options?.starred !== undefined) {
		params.set('starred', String(options.starred));
	}

	const baseEndpoint = feedId ? `/feeds/${feedId}/entries.json` : '/entries.json';

	while (hasNextPage) {
		params.set('page', String(page));
		const endpoint = `${baseEndpoint}?${params.toString()}`;

		logger.info(`Fetching entries page ${page}`);
		const { data, headers } = await makeRequest<unknown>(endpoint);
		const pageEntries = FeedbinEntriesResponseSchema.parse(data);
		entries.push(...pageEntries);

		// Check for next page
		const linkHeader = headers.get('Link');
		const links = parseLinkHeader(linkHeader);
		hasNextPage = !!links.next;
		page++;

		// Respect rate limits
		if (hasNextPage) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	logger.complete(`Fetched ${entries.length} total entries`);
	return entries;
}

/**
 * Fetch feed icons
 */
export async function fetchIcons(): Promise<FeedbinIcon[]> {
	logger.start('Fetching feed icons');
	const { data } = await makeRequest<unknown>('/icons.json');
	const icons = FeedbinIconsResponseSchema.parse(data);
	logger.complete(`Fetched ${icons.length} icons`);
	return icons;
}
