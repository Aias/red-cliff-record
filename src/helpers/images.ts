import type { ExtractSearchResult } from '$lib/queries';

export const findFirstImageUrl = (extracts?: ExtractSearchResult[]): string | null => {
	if (extracts && extracts.length > 0) {
		for (const extract of extracts) {
			if (extract.attachments.length > 0) {
				return extract.attachments[0].url;
			}
		}
	}
	return null;
};
