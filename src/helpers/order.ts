export const generateOrderKey = (before: string | null, after: string | null): string => {
	if (before === null && after === null) return 'a0';
	if (before === null) return 'a' + after;
	if (after === null) return 'z' + before;

	// If strings are different lengths, pad the shorter one
	const maxLength = Math.max(before.length, after.length);
	const paddedBefore = before.padEnd(maxLength, '0');
	const paddedAfter = after.padEnd(maxLength, '0');

	// Find a string halfway between
	let result = '';
	for (let i = 0; i < maxLength; i++) {
		const a = paddedBefore.charCodeAt(i);
		const b = paddedAfter.charCodeAt(i);
		const c = Math.floor((a + b) / 2);
		result += String.fromCharCode(c);

		// If we found a character between them, we can stop
		if (c !== a && c !== b) break;
	}

	return result;
};

export const generateOrderPrefix = (index: number): string => {
	if (index < 25) {
		return String.fromCharCode(97 + index); // a-y
	}

	let result = 'z';
	index -= 25; // Adjust for first 25 single letters

	while (index > 0) {
		result += String.fromCharCode(97 + ((index - 1) % 26));
		index = Math.floor((index - 1) / 26);
	}

	return result;
};
