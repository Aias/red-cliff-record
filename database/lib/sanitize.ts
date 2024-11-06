export const sanitizeString = (str: string): string => {
	// Remove null bytes and replace invalid UTF-8 characters with a replacement character
	return str.replace(/\0/g, '').replace(/[\uFFFD\uFFFE\uFFFF]/g, '');
};
