import { timestamps } from './common';
import { relations } from 'drizzle-orm';
import { text, integer, timestamp, foreignKey, primaryKey, pgSchema } from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';

export const airtableSchema = pgSchema('airtable');

export const extracts = airtableSchema.table(
	'extracts',
	{
		id: text().primaryKey(),
		title: text().notNull(),
		format: text().notNull().default('Fragment'),
		source: text(),
		michelinStars: integer(),
		content: text(),
		notes: text(),
		attachmentCaption: text(),
		parentId: text(),
		lexicographicalOrder: text().notNull().default('a0'),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		publishedAt: timestamp({
			withTimezone: true,
		}),
		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
		}),
	]
);

export const extractsRelations = relations(extracts, ({ many, one }) => ({
	children: many(extracts, {
		relationName: 'parentChild',
	}),
	parent: one(extracts, {
		fields: [extracts.parentId],
		references: [extracts.id],
		relationName: 'parentChild',
	}),
	extractCreators: many(extractCreators, { relationName: 'extractToCreator' }),
	extractSpaces: many(extractSpaces, { relationName: 'extractToSpace' }),
	outgoingConnections: many(extractConnections, { relationName: 'fromExtract' }),
	incomingConnections: many(extractConnections, { relationName: 'toExtract' }),
	attachments: many(attachments),
	integrationRun: one(integrationRuns, {
		fields: [extracts.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const attachments = airtableSchema.table('attachments', {
	id: text().primaryKey(),
	url: text().notNull(),
	filename: text().notNull(),
	size: integer(),
	type: text(),
	width: integer(),
	height: integer(),
	extractId: text()
		.references(() => extracts.id)
		.notNull(),
	...timestamps,
});

export const attachmentsRelations = relations(attachments, ({ one }) => ({
	extract: one(extracts, {
		fields: [attachments.extractId],
		references: [extracts.id],
	}),
}));

export const creators = airtableSchema.table('creators', {
	id: text().primaryKey(),
	name: text().notNull(),
	type: text().notNull().default('Individual'),
	primaryProject: text(),
	website: text(),
	professions: text().array(),
	organizations: text().array(),
	nationalities: text().array(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...timestamps,
});

export const creatorsRelations = relations(creators, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [creators.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const spaces = airtableSchema.table('spaces', {
	id: text().primaryKey(),
	name: text().notNull(),
	fullName: text(),
	icon: text(),
	description: text(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...timestamps,
});

export const spacesRelations = relations(spaces, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [spaces.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const extractCreators = airtableSchema.table(
	'extract_creators',
	{
		extractId: text()
			.references(() => extracts.id)
			.notNull(),
		creatorId: text()
			.references(() => creators.id)
			.notNull(),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.extractId, table.creatorId] })]
);

export const extractCreatorsRelations = relations(extractCreators, ({ one }) => ({
	extract: one(extracts, {
		fields: [extractCreators.extractId],
		references: [extracts.id],
		relationName: 'extractToCreator',
	}),
	creator: one(creators, {
		fields: [extractCreators.creatorId],
		references: [creators.id],
		relationName: 'creatorToExtract',
	}),
}));

export const extractSpaces = airtableSchema.table(
	'extract_spaces',
	{
		extractId: text()
			.references(() => extracts.id)
			.notNull(),
		spaceId: text()
			.references(() => spaces.id)
			.notNull(),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.extractId, table.spaceId] })]
);

export const extractSpacesRelations = relations(extractSpaces, ({ one }) => ({
	extract: one(extracts, {
		fields: [extractSpaces.extractId],
		references: [extracts.id],
		relationName: 'extractToSpace',
	}),
	space: one(spaces, {
		fields: [extractSpaces.spaceId],
		references: [spaces.id],
		relationName: 'spaceToExtract',
	}),
}));

export const extractConnections = airtableSchema.table(
	'extract_connections',
	{
		fromExtractId: text()
			.references(() => extracts.id)
			.notNull(),
		toExtractId: text()
			.references(() => extracts.id)
			.notNull(),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.fromExtractId, table.toExtractId] })]
);

export const extractConnectionsRelations = relations(extractConnections, ({ one }) => ({
	fromExtract: one(extracts, {
		relationName: 'fromExtract',
		fields: [extractConnections.fromExtractId],
		references: [extracts.id],
	}),
	toExtract: one(extracts, {
		relationName: 'toExtract',
		fields: [extractConnections.toExtractId],
		references: [extracts.id],
	}),
}));
