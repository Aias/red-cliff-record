export function logRateLimitInfo(response: {
	headers?: Record<string, string | number | undefined>;
}) {
	const headers = response?.headers;
	if (!headers) return;

	console.log(
		`Rate Limits - Lim: ${headers['x-ratelimit-limit']} / Rem: ${headers['x-ratelimit-remaining']} / Used: ${headers['x-ratelimit-used']} / Reset: ${new Date(Number(headers['x-ratelimit-reset']) * 1000).toLocaleString()} / Res: ${headers['x-ratelimit-resource']}`
	);
}
