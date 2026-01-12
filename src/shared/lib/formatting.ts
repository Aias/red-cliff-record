/**
 * Converts string to title case (first letter of each word capitalized)
 * Works in both client and server environments
 */
export const toTitleCase = (str: string) => str.replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Decodes common HTML entities to their corresponding characters
 * Works in both client and server environments
 *
 * @param text - The text containing HTML entities
 * @returns The decoded text
 * @example
 * decodeHtmlEntities('AT&amp;T') -> 'AT&T'
 * decodeHtmlEntities('&quot;Hello&quot;') -> '"Hello"'
 */
export const decodeHtmlEntities = (text: string): string => {
	const entities: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&apos;': "'",
		'&nbsp;': ' ',
		'&ndash;': '–',
		'&mdash;': '—',
		'&hellip;': '…',
		'&copy;': '©',
		'&reg;': '®',
		'&trade;': '™',
		'&euro;': '€',
		'&pound;': '£',
		'&yen;': '¥',
		'&cent;': '¢',
	};

	// Replace known entities
	let decoded = text;
	for (const [entity, char] of Object.entries(entities)) {
		decoded = decoded.replaceAll(entity, char);
	}

	// Handle numeric character references (&#123; or &#xABC;)
	decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
	decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_, code) =>
		String.fromCharCode(parseInt(code, 16))
	);

	return decoded;
};
