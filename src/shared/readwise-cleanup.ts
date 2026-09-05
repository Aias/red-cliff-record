import { z } from 'zod';

export const ReadwiseCleanupChangeSchema = z.object({
  recordIds: z.tuple([z.int().positive()]).rest(z.int().positive()),
  before: z.array(
    z.object({
      id: z.int().positive(),
      content: z.string().nullable(),
      updatedAt: z.iso.datetime(),
    })
  ),
  content: z.string(),
  source: z.enum(['readwise', 'document', 'model']),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  images: z.array(
    z.object({
      url: z.httpUrl('Cleanup images must use HTTP or HTTPS URLs.'),
      altText: z.string().nullable(),
    })
  ),
});

export const ReadwiseCleanupPreviewSchema = z.object({
  documentId: z.string(),
  recordId: z.int().positive(),
  title: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceAvailable: z.boolean(),
  changes: z.array(ReadwiseCleanupChangeSchema),
  combinablePairs: z.array(z.tuple([z.int().positive(), z.int().positive()])),
  unchangedRecordIds: z.array(z.int().positive()),
  issues: z.array(z.string()),
});

export type ReadwiseCleanupChange = z.infer<typeof ReadwiseCleanupChangeSchema>;
export type ReadwiseCleanupPreview = z.infer<typeof ReadwiseCleanupPreviewSchema>;

export const hasReadwiseCleanupChanges = (change: ReadwiseCleanupChange) =>
  change.recordIds.length > 1 ||
  change.before[0]?.content !== change.content ||
  change.images.length > 0;

export function canCombineReadwiseChanges(
  left: ReadwiseCleanupChange,
  right: ReadwiseCleanupChange,
  pairs: ReadonlyArray<readonly [number, number]>
) {
  return (
    !left.recordIds.some((id) => right.recordIds.includes(id)) &&
    pairs.some(
      ([first, second]) =>
        (left.recordIds.includes(first) && right.recordIds.includes(second)) ||
        (left.recordIds.includes(second) && right.recordIds.includes(first))
    )
  );
}
