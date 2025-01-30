import { relations } from 'drizzle-orm';
import { foreignKey, index, integer, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { type z } from 'zod';
import { contentTimestamps, databaseTimestamps } from '../common';
import { indices, records } from '../main';
import { embeddings } from '../main/embeddings';
import { media } from '../main/media';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

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
		embeddingId: integer('embedding_id').references(() => embeddings.id, {
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
		index().on(table.embeddingId),
	]
);

export const AirtableExtractSelectSchema = createSelectSchema(airtableExtracts);
export type AirtableExtractSelect = z.infer<typeof AirtableExtractSelectSchema>;
export const AirtableExtractInsertSchema = createInsertSchema(airtableExtracts);
export type AirtableExtractInsert = z.infer<typeof AirtableExtractInsertSchema>;
export const AirtableExtractUpdateSchema = createUpdateSchema(airtableExtracts);
export type AirtableExtractUpdate = z.infer<typeof AirtableExtractUpdateSchema>;

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
	archivedAt: timestamp('archived_at', {
		withTimezone: true,
	}),
	mediaId: integer('media_id').references(() => media.id, {
		onDelete: 'set null',
		onUpdate: 'cascade',
	}),
});

export const AirtableAttachmentSelectSchema = createSelectSchema(airtableAttachments);
export type AirtableAttachmentSelect = z.infer<typeof AirtableAttachmentSelectSchema>;
export const AirtableAttachmentInsertSchema = createInsertSchema(airtableAttachments);
export type AirtableAttachmentInsert = z.infer<typeof AirtableAttachmentInsertSchema>;
export const AirtableAttachmentUpdateSchema = createUpdateSchema(airtableAttachments);
export type AirtableAttachmentUpdate = z.infer<typeof AirtableAttachmentUpdateSchema>;

export const airtableAttachmentsRelations = relations(airtableAttachments, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableAttachments.extractId],
		references: [airtableExtracts.id],
	}),
	media: one(media, {
		fields: [airtableAttachments.mediaId],
		references: [media.id],
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
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		embeddingId: integer('embedding_id').references(() => embeddings.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [
		index().on(table.archivedAt),
		index().on(table.indexEntryId),
		index().on(table.embeddingId),
	]
);

export const AirtableCreatorSelectSchema = createSelectSchema(airtableCreators);
export type AirtableCreatorSelect = z.infer<typeof AirtableCreatorSelectSchema>;
export const AirtableCreatorInsertSchema = createInsertSchema(airtableCreators);
export type AirtableCreatorInsert = z.infer<typeof AirtableCreatorInsertSchema>;
export const AirtableCreatorUpdateSchema = createUpdateSchema(airtableCreators);
export type AirtableCreatorUpdate = z.infer<typeof AirtableCreatorUpdateSchema>;

export const airtableCreatorsRelations = relations(airtableCreators, ({ one, many }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableCreators.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indices, {
		relationName: 'indexEntry',
		fields: [airtableCreators.indexEntryId],
		references: [indices.id],
	}),
	creatorExtracts: many(airtableExtractCreators, { relationName: 'creatorToExtract' }),
}));

export const airtableSpaces = integrationSchema.table(
	'airtable_spaces',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		fullName: text('full_name'),
		icon: text('icon'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		embeddingId: integer('embedding_id').references(() => embeddings.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [
		index().on(table.archivedAt),
		index().on(table.indexEntryId),
		index().on(table.embeddingId),
	]
);

export const AirtableSpaceSelectSchema = createSelectSchema(airtableSpaces);
export type AirtableSpaceSelect = z.infer<typeof AirtableSpaceSelectSchema>;
export const AirtableSpaceInsertSchema = createInsertSchema(airtableSpaces);
export type AirtableSpaceInsert = z.infer<typeof AirtableSpaceInsertSchema>;
export const AirtableSpaceUpdateSchema = createUpdateSchema(airtableSpaces);
export type AirtableSpaceUpdate = z.infer<typeof AirtableSpaceUpdateSchema>;

export const airtableSpacesRelations = relations(airtableSpaces, ({ one, many }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableSpaces.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indices, {
		relationName: 'indexEntry',
		fields: [airtableSpaces.indexEntryId],
		references: [indices.id],
	}),
	spaceExtracts: many(airtableExtractSpaces, { relationName: 'spaceToExtract' }),
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

export const AirtableExtractCreatorSelectSchema = createSelectSchema(airtableExtractCreators);
export type AirtableExtractCreatorSelect = z.infer<typeof AirtableExtractCreatorSelectSchema>;
export const AirtableExtractCreatorInsertSchema = createInsertSchema(airtableExtractCreators);
export type AirtableExtractCreatorInsert = z.infer<typeof AirtableExtractCreatorInsertSchema>;
export const AirtableExtractCreatorUpdateSchema = createUpdateSchema(airtableExtractCreators);
export type AirtableExtractCreatorUpdate = z.infer<typeof AirtableExtractCreatorUpdateSchema>;

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

export const AirtableExtractSpaceSelectSchema = createSelectSchema(airtableExtractSpaces);
export type AirtableExtractSpaceSelect = z.infer<typeof AirtableExtractSpaceSelectSchema>;
export const AirtableExtractSpaceInsertSchema = createInsertSchema(airtableExtractSpaces);
export type AirtableExtractSpaceInsert = z.infer<typeof AirtableExtractSpaceInsertSchema>;
export const AirtableExtractSpaceUpdateSchema = createUpdateSchema(airtableExtractSpaces);
export type AirtableExtractSpaceUpdate = z.infer<typeof AirtableExtractSpaceUpdateSchema>;

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

export const AirtableExtractConnectionSelectSchema = createSelectSchema(airtableExtractConnections);
export type AirtableExtractConnectionSelect = z.infer<typeof AirtableExtractConnectionSelectSchema>;
export const AirtableExtractConnectionInsertSchema = createInsertSchema(airtableExtractConnections);
export type AirtableExtractConnectionInsert = z.infer<typeof AirtableExtractConnectionInsertSchema>;
export const AirtableExtractConnectionUpdateSchema = createUpdateSchema(airtableExtractConnections);
export type AirtableExtractConnectionUpdate = z.infer<typeof AirtableExtractConnectionUpdateSchema>;

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

export const airtableIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	airtableExtracts: many(airtableExtracts),
	airtableCreators: many(airtableCreators),
	airtableSpaces: many(airtableSpaces),
}));
