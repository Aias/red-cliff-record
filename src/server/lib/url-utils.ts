import { z } from 'zod/v4';

// More robust URL schema with custom error message
const urlSchema = z.url({
	error: 'Invalid URL format. Please provide a valid URL.',
});

type UrlOptions = {
	skipHttps?: boolean;
};

/**
 * Validates and formats a URL string, ensuring it has an HTTP/HTTPS protocol by default
 *
 * This function automatically adds https:// to URLs like "example.com" to make them valid.
 * For example, "blog.edu" becomes "https://blog.edu" before validation.
 *
 * @param url - The URL string to validate and format
 * @param safe - If true, returns a SafeParseReturn object instead of throwing
 * @param options - Configuration options
 * @returns The validated URL or a SafeParseReturn object
 */
export function validateAndFormatUrl(url: string, safe?: false, options?: UrlOptions): string;
export function validateAndFormatUrl(
	url: string,
	safe: true,
	options?: UrlOptions
): z.ZodSafeParseResult<string>;
export function validateAndFormatUrl(
	url: string,
	safe?: boolean,
	options?: UrlOptions
): string | z.ZodSafeParseResult<string> {
	// Default options
	const { skipHttps = false } = options || {};

	// Add https:// if no HTTP/HTTPS protocol is present (unless explicitly skipped)
	let formattedUrl = url;
	if (!skipHttps && !url.match(/^https?:\/\//)) {
		formattedUrl = `https://${url}`;
	}

	// Validate and return based on safe parameter
	if (safe === true) {
		return urlSchema.safeParse(formattedUrl);
	} else {
		try {
			return urlSchema.parse(formattedUrl);
		} catch (error) {
			// Enhance error message with the attempted URL
			throw new Error(
				`Invalid URL: ${url}. ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
}

/**
 * Maps a URL string to a validated URL
 *
 * @param url - The URL to validate and format
 * @returns The validated URL or undefined if invalid
 */
export function mapUrl(url?: string | null): string | undefined {
	if (!url) return undefined;

	try {
		const { success, data } = validateAndFormatUrl(url, true);
		return success ? data : undefined;
	} catch {
		console.error('Invalid URL:', url);
		return undefined;
	}
}

/**
 * Helper to validate URLs and convert invalid ones to null
 */
export const flexibleUrl = z.preprocess((val) => {
	// If null or undefined, return null
	if (val === null || val === undefined) return null;

	// If not a string, return null
	if (typeof val !== 'string') {
		console.warn(`Invalid URL type: expected string, got ${typeof val}`);
		return null;
	}

	// If empty string, return null
	if (val.trim() === '') {
		console.warn('Empty string provided as URL, converting to null');
		return null;
	}

	// Try to parse as URL - if it fails, return null
	try {
		new URL(val);
		return val;
	} catch {
		// Invalid URL format - return null
		console.warn(
			`Failed to parse invalid URL: "${val.length > 100 ? val.substring(0, 100) + '...' : val}"`
		);
		return null;
	}
}, z.url().nullable());
