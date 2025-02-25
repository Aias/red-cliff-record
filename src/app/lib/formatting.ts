import { z } from 'zod';

export const toTitleCase = (str: string) => str.replace(/\b\w/g, (char) => char.toUpperCase());

export const formatNumber = (num: number) => new Intl.NumberFormat().format(Math.round(num));

export const formatTime = (date: Date | string) =>
	new Date(date).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	});

export const formatISODate = (date: Date): string => date.toISOString().split('T')[0]!;

export const getArticle = (str: string) => (/^[aeiou]/i.test(str) ? 'an' : 'a');

export const formatCreatorDescription = (
	type: string,
	professions?: string[],
	nationalities?: string[]
) => {
	// Format nationalities if present (hyphenated, maintain case)
	const nationalityString = nationalities?.length ? nationalities.join('-') + ' ' : '';

	// Format professions if present (lowercase, proper comma/and formatting)
	const professionString = professions?.length
		? professions
				.map((p) => p.toLowerCase())
				.reduce((acc, curr, idx, arr) => {
					if (idx === 0) return curr;
					if (arr.length === 2) return `${acc} and ${curr}`;
					if (idx === arr.length - 1) return `${acc}, and ${curr}`;
					return `${acc}, ${curr}`;
				})
		: type.toLowerCase();

	// Use existing getArticle helper function
	const firstWord = nationalityString || professionString;
	const article = toTitleCase(getArticle(firstWord));

	return `${article} ${nationalityString}${professionString}.`;
};

// More robust URL schema with custom error message
const urlSchema = z.string().url({
	message: 'Invalid URL format. Please provide a valid URL.',
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
): z.SafeParseReturnType<string, string>;
export function validateAndFormatUrl(
	url: string,
	safe?: boolean,
	options?: UrlOptions
): string | z.SafeParseReturnType<string, string> {
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
 * Transforms empty strings to null when validating with Zod
 *
 * This helper creates a Zod transformer that converts empty strings to null
 * before validating with the provided schema. Useful for handling optional
 * string fields from APIs that might return empty strings instead of null.
 *
 * @param schema - The Zod schema to apply after the transformation
 * @returns A Zod schema that transforms empty strings to null before validation
 * @example
 * const nameSchema = emptyStringToNull(z.string())
 * // '' -> null, 'value' -> 'value'
 */
export const emptyStringToNull = <T extends z.ZodType>(schema: T) =>
	z
		.string()
		.nullable()
		.transform((str) => (str === '' ? null : str))
		.pipe(schema.nullable());
