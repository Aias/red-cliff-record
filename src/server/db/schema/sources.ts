import { relations, sql, type SQL } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	json,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { databaseTimestamps } from './common';
import { media } from './media';
import { IntegrationType, integrationTypeEnum } from './operations';

export const LinkMetadataSchema = z
	.object({
		linkText: z.string().optional(),
		attributes: z.record(z.string()).optional(),
	})
	.strict();
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

export const sources = pgTable(
	'sources',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull().unique(),
		domain: text('domain').generatedAlwaysAs(
			(): SQL => sql`LOWER(regexp_replace(${sources.url}, '^https?://([^/]+).*$', '\\1'))`
		),
		title: text('title'),
		origin: integrationTypeEnum('origin').notNull().default(IntegrationType.enum.manual),
		shouldCrawl: boolean('should_crawl').notNull().default(true),
		lastCrawlDate: timestamp('last_crawl_date', { withTimezone: true }),
		lastSuccessfulCrawlDate: timestamp('last_successful_crawl_date', { withTimezone: true }),
		lastHttpStatus: integer('last_http_status'),
		...databaseTimestamps,
	},
	(table) => [index().on(table.domain), index().on(table.lastCrawlDate, table.lastHttpStatus)]
);
// Full-text source contents

export const sourceContents = pgTable(
	'source_contents',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		contentHtml: text('content_html').notNull(),
		contentMarkdown: text('content_markdown'),
		metadata: json('metadata'), // headers, meta tags, etc
		...databaseTimestamps,
	},
	(table) => [index().on(table.sourceId)]
);
// Relationship table for source connections

export const sourceConnections = pgTable(
	'source_connections',
	{
		id: serial('id').primaryKey(),
		fromSourceId: integer('from_source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		toSourceId: integer('to_source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		metadata: json('metadata').$type<LinkMetadata>(),
		...databaseTimestamps,
	},
	(table) => [
		unique().on(table.fromSourceId, table.toSourceId),
		index().on(table.fromSourceId),
		index().on(table.toSourceId),
	]
); // Relations

export const sourceRelations = relations(sources, ({ many }) => ({
	contents: many(sourceContents),
	outgoingLinks: many(sourceConnections, { relationName: 'from' }),
	incomingLinks: many(sourceConnections, { relationName: 'to' }),
	media: many(media, { relationName: 'sourceMedia' }),
}));

export const sourceContentsRelations = relations(sourceContents, ({ one }) => ({
	source: one(sources, {
		fields: [sourceContents.sourceId],
		references: [sources.id],
	}),
}));

export const sourceLinksRelations = relations(sourceConnections, ({ one }) => ({
	from: one(sources, {
		fields: [sourceConnections.fromSourceId],
		references: [sources.id],
		relationName: 'from',
	}),
	to: one(sources, {
		fields: [sourceConnections.toSourceId],
		references: [sources.id],
		relationName: 'to',
	}),
}));
