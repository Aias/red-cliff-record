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
	getInputTitle: (item: TInput) => string;
	getOutputTitle: (item: TOutput) => string;
}

export interface QueueActions<TInput, TOutput> {
	handleSearch: (query: string) => Promise<TOutput[]>;
	handleCreate: (input: TInput) => Promise<TOutput>;
	handleLink: (inputId: string, outputId: string) => Promise<TInput | undefined>;
	handleUnlink: (inputIds: string[]) => Promise<TInput[]>;
	handleArchive: (inputIds: string[]) => Promise<TInput[]>;
	handleUnarchive: (inputIds: string[]) => Promise<TInput[]>;
}
