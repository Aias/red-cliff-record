export function logRateLimitInfo(response: {
	headers?: Record<string, string | number | undefined>;
}) {
	const headers = response?.headers;
	if (!headers) return;

	console.log('Rate Limit Status:');
	console.log(`  Limit: ${headers['x-ratelimit-limit']}`);
	console.log(`  Remaining: ${headers['x-ratelimit-remaining']}`);
	console.log(`  Used: ${headers['x-ratelimit-used']}`);
	console.log(`  Reset: ${new Date(Number(headers['x-ratelimit-reset']) * 1000).toISOString()}`);
	console.log(`  Resource: ${headers['x-ratelimit-resource']}`);
}
