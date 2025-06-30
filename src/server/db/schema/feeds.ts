import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	timestamp,
} from 'drizzle-orm/pg-core';
import { text } from 'drizzle-orm/pg-core';
import { z } from 'zod/v4';
import {
	contentTimestamps,
	databaseTimestamps,
	integrationRuns,
	textEmbeddingColumns,
} from './operations';
import { records } from './records';

export const feedSourceEnum = pgEnum('feed_source', ['feedbin', 'feedly', 'reeder']);

export const feeds = pgTable(
	'feeds',
	{
		id: bigint('id', { mode: 'number' }).primaryKey(),
		name: text('name').notNull(),
		feedUrl: text('feed_url').notNull(),
		siteUrl: text('site_url'),
		iconUrl: text('icon_url'),
		description: text('description'),
		sources: feedSourceEnum('sources').array().notNull(),
		ownerId: integer('owner_id').references(() => records.id),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.feedUrl), index().on(table.siteUrl), index().on(table.ownerId)]
);

export const FeedEnclosure = z.object({
	enclosureUrl: z.url(),
	enclosureType: z.string(),
	enclosureLength: z.number(),
	itunesDuration: z.string().optional().nullable(),
	itunesImage: z.url().optional().nullable(),
});
export type FeedEnclosure = z.infer<typeof FeedEnclosure>;

export const feedEntries = pgTable(
	'feed_entries',
	{
		id: bigint('id', { mode: 'number' }).primaryKey(),
		feedId: bigint('feed_id', { mode: 'number' })
			.notNull()
			.references(() => feeds.id),
		url: text('url').notNull(),
		title: text('title'),
		author: text('author'),
		content: text('content'),
		imageUrls: text('image_urls').array(),
		enclosure: jsonb('enclosure').$type<FeedEnclosure>(),
		starred: boolean('starred').notNull().default(false),
		read: boolean('read').notNull().default(false),
		recordId: integer('record_id').references(() => records.id),
		publishedAt: timestamp('published_at', {
			withTimezone: true,
		}),
		integrationRunId: integer('integration_run_id').references(() => integrationRuns.id),
		...databaseTimestamps,
		...textEmbeddingColumns,
	},
	(table) => [
		index().on(table.feedId),
		index().on(table.recordId),
		index().on(table.integrationRunId),
		index().on(table.url),
	]
);
