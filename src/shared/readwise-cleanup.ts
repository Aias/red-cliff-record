import { z } from 'zod';

const RecordSnapshotSchema = z.object({
  id: z.int().positive(),
  content: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const ReadwiseCleanupChangeSchema = z.object({
  target: RecordSnapshotSchema,
  merged: z.array(RecordSnapshotSchema),
  content: z.string(),
  source: z.enum(['document', 'model', 'readwise']),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  images: z.array(z.object({ url: z.httpUrl(), altText: z.string().nullable() })),
  changed: z.boolean(),
});

export const ReadwiseCleanupPreviewSchema = z.object({
  documentId: z.string(),
  recordId: z.int().positive(),
  title: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceAvailable: z.boolean(),
  changes: z.array(ReadwiseCleanupChangeSchema),
  mergeable: z.array(z.tuple([z.int().positive(), z.int().positive()])),
  issues: z.array(z.string()),
});

export type ReadwiseCleanupChange = z.infer<typeof ReadwiseCleanupChangeSchema>;
export type ReadwiseCleanupPreview = z.infer<typeof ReadwiseCleanupPreviewSchema>;
