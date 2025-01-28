import { pgTable, serial, vector } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { type z } from 'zod';
import { databaseTimestamps } from '../common';

export const embeddings = pgTable('embeddings', {
	id: serial('id').primaryKey(),
	embedding: vector('embedding', { dimensions: 768 }).notNull(),
	...databaseTimestamps,
});

export const EmbeddingsSelectSchema = createSelectSchema(embeddings);
export type EmbeddingsSelect = z.infer<typeof EmbeddingsSelectSchema>;
export const EmbeddingsInsertSchema = createInsertSchema(embeddings);
export type EmbeddingsInsert = z.infer<typeof EmbeddingsInsertSchema>;
export const EmbeddingsUpdateSchema = createUpdateSchema(embeddings);
export type EmbeddingsUpdate = z.infer<typeof EmbeddingsUpdateSchema>;
