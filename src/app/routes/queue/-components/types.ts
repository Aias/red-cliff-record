export interface QueueItem {
	id: string;
	title: string;
	avatarUrl?: string | null;
	externalUrl?: string | null;
	description?: string | null;
	mapped?: boolean;
	archivedAt?: Date | null;
}

export interface QueueConfig<TInput, TOutput> {
	name: string;
	mapToQueueItem: (input: TInput) => QueueItem;
	getOutputDefaults: (input: TInput) => Partial<TOutput>;
	getItemId: (item: TInput) => string;
	lookup: (item: TInput) => string;
}
