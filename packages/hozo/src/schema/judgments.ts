import { index, integer, jsonb, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-orm/zod';
import { databaseTimestampsNonUpdatable } from './operations';
import { records } from './records';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const judgmentQuestions = [
  'record_type',
  'record_format',
  'format_suggestions',
  'merge_fields',
  'copyedit',
] as const;
export type JudgmentQuestion = (typeof judgmentQuestions)[number];

export const judgments = pgTable(
  'judgments',
  {
    id: serial('id').primaryKey(),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    question: text('question').notNull().$type<JudgmentQuestion>(),
    model: text('model').notNull(),
    fingerprint: text('fingerprint').notNull(),
    state: jsonb('state').notNull().$type<Json>(),
    answers: jsonb('answers').notNull().$type<Json>(),
    result: jsonb('result'),
    inputTokens: integer('input_tokens').notNull(),
    ...databaseTimestampsNonUpdatable,
  },
  (table) => [
    index().on(table.recordId, table.question, table.recordCreatedAt),
    index().on(table.fingerprint),
  ]
);

export const JudgmentSelectSchema = createSelectSchema(judgments);
export type JudgmentSelect = typeof judgments.$inferSelect;
export type JudgmentInsert = typeof judgments.$inferInsert;
