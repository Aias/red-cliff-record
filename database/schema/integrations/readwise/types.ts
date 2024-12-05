import { ReadwiseCategory, ReadwiseLocation } from './schema';
import { z } from 'zod';
import { emptyStringToNull } from '../../utils/schema-helpers';

const ReadwiseTagSchema = z.object({
	name: z.string(),
	type: z.string(),
	created: z.number(),
});

export const ReadwiseArticleSchema = z.object({
	id: z.string(),
	url: z.string().url(),
	title: z.string().nullable(),
	author: z.string().nullable(),
	source: z.string().nullable(),
	category: ReadwiseCategory,
	location: ReadwiseLocation.nullable(),
	tags: z.record(ReadwiseTagSchema).nullable(),
	site_name: z.string().nullable(),
	word_count: z.number().int().nullable(),
	summary: z.string().nullable(),
	image_url: emptyStringToNull(z.string().url().nullable()),
	content: z.string().nullable(),
	source_url: emptyStringToNull(z.string().url().nullable()),
	notes: z.string().nullable(),
	parent_id: z.string().nullable(),
	reading_progress: z.number().min(0).max(1),
	saved_at: z.coerce.date(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	last_moved_at: z.coerce.date(),
	published_date: z.coerce.date().nullable(),
	first_opened_at: z.coerce.date().nullable(),
	last_opened_at: z.coerce.date().nullable(),
});

export const ReadwiseArticlesResponseSchema = z.object({
	results: z.array(ReadwiseArticleSchema),
	nextPageCursor: z.string().nullable(),
	count: z.number(),
});

export type ReadwiseArticle = z.infer<typeof ReadwiseArticleSchema>;
export type ReadwiseArticlesResponse = z.infer<typeof ReadwiseArticlesResponseSchema>;
