import { z } from 'zod';
import { ReadwiseCategory, ReadwiseLocation } from '~//db/schema/integrations';
import { emptyStringToNull } from '../common/validation-helpers';

const ReadwiseTagSchema = z.object({
	name: z.string(),
	type: z.string(),
	created: z.number(),
});

export const ReadwiseArticleSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	summary: z.string().nullable(),
	author: z.string().nullable(),
	site_name: z.string().nullable(),
	source: z.string().nullable(),
	content: z.string().nullable(),
	notes: z.string().nullable(),
	category: ReadwiseCategory,
	location: ReadwiseLocation.nullable(),
	tags: z
		.record(ReadwiseTagSchema)
		.nullable()
		.transform((val) => {
			const keys = Object.keys(val ?? {});
			return keys.length > 0 ? keys : null;
		}),
	word_count: z.number().int().nullable(),
	url: z.string().url(), // Internal Readwise URL
	source_url: emptyStringToNull(z.string().url().nullable()),
	image_url: emptyStringToNull(z.string().url().nullable()),
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
