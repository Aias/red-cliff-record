// Constants for better maintainability and performance
const MIN_CHAR = 'a'.charCodeAt(0); // 97
const MAX_CHAR = 'z'.charCodeAt(0); // 122
const CHAR_RANGE = MAX_CHAR - MIN_CHAR + 1; // 26

export const generateOrderKey = (lowerBound: string | null, upperBound: string | null): string => {
	if (lowerBound === null && upperBound === null) return 'a0';
	if (lowerBound === null) return 'a' + upperBound;
	if (upperBound === null) return lowerBound + 'a';

	// Validation using renamed variables
	if (lowerBound && !/^[a-z0-9]+$/.test(lowerBound)) throw new Error('Invalid lower bound key');
	if (upperBound && !/^[a-z0-9]+$/.test(upperBound)) throw new Error('Invalid upper bound key');

	// If the strings are equal, append a character to avoid collisions
	if (lowerBound === upperBound) return lowerBound + 'a';

	// Optimize padding by only padding up to first differing character
	let firstDiff = 0;
	while (
		firstDiff < lowerBound.length &&
		firstDiff < upperBound.length &&
		lowerBound[firstDiff] === upperBound[firstDiff]
	) {
		firstDiff++;
	}

	const maxLength = Math.max(lowerBound.length, upperBound.length);
	const paddedLowerBound = lowerBound.padEnd(maxLength, '0');
	const paddedUpperBound = upperBound.padEnd(maxLength, '0');

	let result = lowerBound.slice(0, firstDiff);
	const i = firstDiff;

	// More sophisticated midpoint calculation to avoid running out of space
	const a = paddedLowerBound.charCodeAt(i);
	const b = paddedUpperBound.charCodeAt(i);

	if (b - a > 1) {
		// If there's room between characters, use midpoint
		result += String.fromCharCode(a + Math.ceil((b - a) / 2));
	} else {
		// If characters are adjacent, append a character
		result += paddedLowerBound[i] + 'a';
	}

	return result;
};

export const generateOrderPrefix = (index: number): string => {
	if (index < 0) throw new Error('Index must be non-negative');

	if (index < CHAR_RANGE - 1) {
		// Use 25 from CHAR_RANGE
		return String.fromCharCode(MIN_CHAR + index);
	}

	// More efficient string building using array
	const chars: string[] = ['z'];
	index -= CHAR_RANGE - 1;

	while (index > 0) {
		chars.push(String.fromCharCode(MIN_CHAR + ((index - 1) % CHAR_RANGE)));
		index = Math.floor((index - 1) / CHAR_RANGE);
	}

	return chars.join('');
};

// Add helper function to validate order keys
export const isValidOrderKey = (key: string): boolean => {
	return /^[a-z][a-z0-9]*$/.test(key);
};
