/**
 * Logs API rate limit information from response headers
 *
 * This utility extracts and formats rate limit information from standard
 * X-RateLimit headers commonly used by APIs. It helps with monitoring
 * API usage and preventing rate limit issues.
 *
 * @param response - The API response object containing headers
 */
export function logRateLimitInfo(response: {
	headers?: Record<string, string | number | undefined>;
}): void {
	const headers = response?.headers;
	if (!headers) return;

	// Extract rate limit information from headers
	const limit = headers['x-ratelimit-limit'];
	const remaining = headers['x-ratelimit-remaining'];
	const used = headers['x-ratelimit-used'];
	const resetTimestamp = headers['x-ratelimit-reset'];
	const resource = headers['x-ratelimit-resource'];

	// Format reset time as a readable date string if available
	const resetTime = resetTimestamp
		? new Date(Number(resetTimestamp) * 1000).toLocaleString()
		: 'N/A';

	console.log(
		`Rate Limits - Limit: ${limit || 'N/A'} | ` +
			`Remaining: ${remaining || 'N/A'} | ` +
			`Used: ${used || 'N/A'} | ` +
			`Reset: ${resetTime} | ` +
			`Resource: ${resource || 'N/A'}`
	);
}
