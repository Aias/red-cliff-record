export interface QueueItem {
	id: string;
	title: string;
	avatarUrl?: string | null;
	externalUrl?: string | null;
	description?: string | null;
	mapped?: boolean;
	archivedAt?: Date | null;
}

export interface QueueConfig<TInput, TOutput, TOutputCreate = Partial<TOutput>> {
	name: string;
	mapToQueueItem: (input: TInput) => QueueItem;
	getOutputDefaults: (input: TInput) => TOutputCreate;
	getInputId: (item: TInput) => string;
	getOutputId: (item: TOutput) => string;
	lookup: (item: TInput) => string;
}
