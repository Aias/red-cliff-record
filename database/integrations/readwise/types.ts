import { ReadwiseCategory, ReadwiseLocation } from '@schema/main/readwise';

export interface ReadwiseTag {
	name: string;
	type: string;
	created: number;
}

export interface ReadwiseArticle {
	id: string;
	url: string;
	source_url: string;
	title: string;
	content: string | null;
	author: string;
	source: string;
	category: ReadwiseCategory;
	location: ReadwiseLocation;
	tags: Record<string, ReadwiseTag>;
	site_name: string | null;
	word_count: number;
	created_at: string;
	updated_at: string;
	notes: string;
	published_date: number | null; // Unix timestamp
	summary: string;
	image_url: string;
	parent_id: string | null;
	reading_progress: number;
	first_opened_at: string | null;
	last_opened_at: string | null;
	saved_at: string;
	last_moved_at: string;
}

export type ReadwiseArticlesResponse = {
	results: ReadwiseArticle[];
	nextPageCursor: string | null;
	count: number;
};
