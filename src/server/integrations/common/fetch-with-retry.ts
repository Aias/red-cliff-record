import { logRateLimitInfo } from './log-rate-limit-info';
import type { createIntegrationLogger } from './logging';

export interface FetchRetryOptions {
	retries?: number;
	backoffMs?: number;
	logger?: ReturnType<typeof createIntegrationLogger>;
}

export async function fetchWithRetry(
	url: string,
	init: RequestInit = {},
	{ retries = 3, backoffMs = 1000, logger }: FetchRetryOptions = {}
): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		const response = await fetch(url, init);
		logRateLimitInfo({ headers: Object.fromEntries(response.headers.entries()) });
		if (response.ok || attempt >= retries || (response.status < 500 && response.status !== 429)) {
			return response;
		}
		const delay = backoffMs * 2 ** attempt;
		logger?.warn?.(`Request failed with ${response.status}. Retrying in ${delay}ms...`);
		await new Promise((r) => setTimeout(r, delay));
	}
}
