import { contentTimestamps, databaseTimestamps } from '../../operations/common';
import { relations } from 'drizzle-orm';
import { text, integer, timestamp, foreignKey, primaryKey, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../../operations/schema';
import { integrationSchema } from '..';
import { indexEntries, records } from '../../main/schema';

export const airtableExtracts = integrationSchema.table(
	'airtable_extracts',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		format: text('format').notNull().default('Fragment'),
		source: text('source'),
		michelinStars: integer('michelin_stars'),
		content: text('content'),
		notes: text('notes'),
		attachmentCaption: text('attachment_caption'),
		parentId: text('parent_id'),
		lexicographicalOrder: text('lexicographical_order').notNull().default('a0'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		publishedAt: timestamp('published_at', {
			withTimezone: true,
		}),
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
		}),
		index().on(table.archivedAt),
		index().on(table.recordId),
	]
);

export const airtableExtractsRelations = relations(airtableExtracts, ({ many, one }) => ({
	children: many(airtableExtracts, {
		relationName: 'parentChild',
	}),
	parent: one(airtableExtracts, {
		fields: [airtableExtracts.parentId],
		references: [airtableExtracts.id],
		relationName: 'parentChild',
	}),
	extractCreators: many(airtableExtractCreators, { relationName: 'extractToCreator' }),
	extractSpaces: many(airtableExtractSpaces, { relationName: 'extractToSpace' }),
	outgoingConnections: many(airtableExtractConnections, { relationName: 'fromExtract' }),
	incomingConnections: many(airtableExtractConnections, { relationName: 'toExtract' }),
	attachments: many(airtableAttachments),
	integrationRun: one(integrationRuns, {
		fields: [airtableExtracts.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [airtableExtracts.recordId],
		references: [records.id],
	}),
}));

export const airtableAttachments = integrationSchema.table('airtable_attachments', {
	id: text('id').primaryKey(),
	url: text('url').notNull(),
	filename: text('filename').notNull(),
	size: integer('size'),
	type: text('type'),
	width: integer('width'),
	height: integer('height'),
	extractId: text('extract_id')
		.references(() => airtableExtracts.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		})
		.notNull(),
	...databaseTimestamps,
});

export const airtableAttachmentsRelations = relations(airtableAttachments, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableAttachments.extractId],
		references: [airtableExtracts.id],
	}),
}));

export const airtableCreators = integrationSchema.table(
	'airtable_creators',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		type: text('type').notNull().default('Individual'),
		primaryProject: text('primary_project'),
		website: text('website'),
		professions: text('professions').array(),
		organizations: text('organizations').array(),
		nationalities: text('nationalities').array(),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indexEntries.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [index().on(table.archivedAt), index().on(table.indexEntryId)]
);

export const airtableCreatorsRelations = relations(airtableCreators, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableCreators.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indexEntries, {
		fields: [airtableCreators.indexEntryId],
		references: [indexEntries.id],
	}),
}));

export const airtableSpaces = integrationSchema.table(
	'airtable_spaces',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		fullName: text('full_name'),
		icon: text('icon'),
		description: text('description'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indexEntries.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [index().on(table.archivedAt), index().on(table.indexEntryId)]
);

export const airtableSpacesRelations = relations(airtableSpaces, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableSpaces.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indexEntries, {
		fields: [airtableSpaces.indexEntryId],
		references: [indexEntries.id],
	}),
}));

export const airtableExtractCreators = integrationSchema.table(
	'airtable_extract_creators',
	{
		extractId: text('extract_id')
			.references(() => airtableExtracts.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		creatorId: text('creator_id')
			.references(() => airtableCreators.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		...databaseTimestamps,
	},
	(table) => [primaryKey({ columns: [table.extractId, table.creatorId] })]
);

export const airtableExtractCreatorsRelations = relations(airtableExtractCreators, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableExtractCreators.extractId],
		references: [airtableExtracts.id],
		relationName: 'extractToCreator',
	}),
	creator: one(airtableCreators, {
		fields: [airtableExtractCreators.creatorId],
		references: [airtableCreators.id],
		relationName: 'creatorToExtract',
	}),
}));

export const airtableExtractSpaces = integrationSchema.table(
	'airtable_extract_spaces',
	{
		extractId: text('extract_id')
			.references(() => airtableExtracts.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		spaceId: text('space_id')
			.references(() => airtableSpaces.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		...databaseTimestamps,
	},
	(table) => [primaryKey({ columns: [table.extractId, table.spaceId] })]
);

export const airtableExtractSpacesRelations = relations(airtableExtractSpaces, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableExtractSpaces.extractId],
		references: [airtableExtracts.id],
		relationName: 'extractToSpace',
	}),
	space: one(airtableSpaces, {
		fields: [airtableExtractSpaces.spaceId],
		references: [airtableSpaces.id],
		relationName: 'spaceToExtract',
	}),
}));

export const airtableExtractConnections = integrationSchema.table(
	'airtable_extract_connections',
	{
		fromExtractId: text('from_extract_id')
			.references(() => airtableExtracts.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		toExtractId: text('to_extract_id')
			.references(() => airtableExtracts.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		...databaseTimestamps,
	},
	(table) => [primaryKey({ columns: [table.fromExtractId, table.toExtractId] })]
);

export const airtableExtractConnectionsRelations = relations(
	airtableExtractConnections,
	({ one }) => ({
		fromExtract: one(airtableExtracts, {
			relationName: 'fromExtract',
			fields: [airtableExtractConnections.fromExtractId],
			references: [airtableExtracts.id],
		}),
		toExtract: one(airtableExtracts, {
			relationName: 'toExtract',
			fields: [airtableExtractConnections.toExtractId],
			references: [airtableExtracts.id],
		}),
	})
);

export type AirtableExtract = typeof airtableExtracts.$inferSelect;
export type NewAirtableExtract = typeof airtableExtracts.$inferInsert;
export type AirtableExtractConnection = typeof airtableExtractConnections.$inferSelect;
export type NewAirtableExtractConnection = typeof airtableExtractConnections.$inferInsert;
export type AirtableCreator = typeof airtableCreators.$inferSelect;
export type NewAirtableCreator = typeof airtableCreators.$inferInsert;
export type AirtableExtractCreator = typeof airtableExtractCreators.$inferSelect;
export type NewAirtableExtractCreator = typeof airtableExtractCreators.$inferInsert;
export type AirtableSpace = typeof airtableSpaces.$inferSelect;
export type NewAirtableSpace = typeof airtableSpaces.$inferInsert;
export type AirtableExtractSpace = typeof airtableExtractSpaces.$inferSelect;
export type NewAirtableExtractSpace = typeof airtableExtractSpaces.$inferInsert;
export type AirtableAttachment = typeof airtableAttachments.$inferSelect;
export type NewAirtableAttachment = typeof airtableAttachments.$inferInsert;
