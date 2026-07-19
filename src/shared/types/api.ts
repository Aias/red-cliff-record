import { IntegrationTypeSchema } from '@hozo/schema/operations.shared';
import { RecordTypeSchema } from '@hozo/schema/records.shared';
import { z } from 'zod';

export const DEFAULT_LIMIT = 50;

// Core ID types used throughout the API
export const IdSchema = z.number().int().positive();
export const CoercedIdSchema = z.coerce.number().int().positive();
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IdParamSchema = z.object({ id: IdSchema });
export type DbId = z.infer<typeof IdSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;

export type IdParamList = {
  ids: Array<IdParam>;
};

// API Input/Output Schemas
const OrderByFieldSchema = z.enum([
  'recordUpdatedAt',
  'recordCreatedAt',
  'title',
  'contentCreatedAt',
  'contentUpdatedAt',
  'eloScore',
  'id',
]);

const OrderDirectionSchema = z.enum(['asc', 'desc']);

export const OrderCriteriaSchema = z.object({
  field: OrderByFieldSchema,
  direction: OrderDirectionSchema.optional().default('desc'),
});

export const RecordFiltersSchema = z.object({
  types: z.array(RecordTypeSchema).optional(),
  hasParent: z.boolean().optional(),
  hasTitle: z.boolean().optional(),
  minElo: z.number().int().optional(),
  maxElo: z.number().int().optional(),
  isPrivate: z.boolean().optional(),
  isCurated: z.boolean().optional(),
  hasReminder: z.boolean().optional(),
  hasEmbedding: z.boolean().optional(),
  hasMedia: z.boolean().optional(),
  sources: z.array(IntegrationTypeSchema).optional(),
});

export const LimitSchema = z.number().int().positive();
export const OffsetSchema = z.number().int().gte(0);
export const OrderBySchema = z.array(OrderCriteriaSchema);

export const ListRecordsInputSchema = z.object({
  searchQuery: z.string().optional(),
  strategy: z.enum(['hybrid', 'lexical', 'vector']).optional(),
  filters: RecordFiltersSchema.optional().default({}),
  limit: LimitSchema.optional().default(DEFAULT_LIMIT),
  offset: OffsetSchema.optional().default(0),
  orderBy: OrderBySchema.optional().default([{ field: 'recordCreatedAt', direction: 'desc' }]),
});

export type ListRecordsInput = z.infer<typeof ListRecordsInputSchema>;

export const SubmitMatchupInputSchema = z
  .union([
    z.object({ winnerId: IdSchema, loserId: IdSchema }),
    z.object({ drawIds: z.tuple([IdSchema, IdSchema]) }),
  ])
  .refine(
    (input) =>
      'winnerId' in input
        ? input.winnerId !== input.loserId
        : input.drawIds[0] !== input.drawIds[1],
    { message: 'A record cannot face itself' }
  );

export const GetMatchupInputSchema = z.object({
  recordType: RecordTypeSchema,
  focusRecordId: IdSchema.optional(),
  excludeIds: z.array(IdSchema).optional().default([]),
});

export const GetOpponentsInputSchema = z.object({
  recordId: IdSchema,
  count: z.number().int().positive().optional().default(3),
  excludeIds: z.array(IdSchema).optional().default([]),
});

export const SearchRecordsInputSchema = z.object({
  query: z.string(),
  filters: z
    .object({
      recordType: RecordTypeSchema.optional(),
    })
    .optional()
    .default({}),
  limit: LimitSchema.optional().default(10),
});
