export interface TimeSortable {
	contentCreatedAt: Date | null;
	contentUpdatedAt: Date | null;
	recordCreatedAt: Date;
	recordUpdatedAt: Date;
}

export function sortByTime(a: TimeSortable, b: TimeSortable) {
	// Use contentCreatedAt if both records have it, otherwise fall back to recordCreatedAt
	if (a.contentCreatedAt && b.contentCreatedAt) {
		return a.contentCreatedAt.getTime() - b.contentCreatedAt.getTime();
	}
	return a.recordCreatedAt.getTime() - b.recordCreatedAt.getTime();
}
