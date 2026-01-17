import { IntegrationTypeSchema, RecordTypeSchema } from '@aias/hozo';
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
  'rating',
  'id',
]);

const OrderDirectionSchema = z.enum(['asc', 'desc']);

export const OrderCriteriaSchema = z.object({
  field: OrderByFieldSchema,
  direction: OrderDirectionSchema.optional().default('desc'),
});

export const RecordFiltersSchema = z.object({
  types: z.array(RecordTypeSchema).optional(),
  title: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  hasParent: z.boolean().optional(),
  hasTitle: z.boolean().optional(),
  minRating: z.number().int().gte(0).optional(),
  maxRating: z.number().int().lte(3).optional(),
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
  filters: RecordFiltersSchema.optional().default({}),
  limit: LimitSchema.optional().default(DEFAULT_LIMIT),
  offset: OffsetSchema.optional().default(0),
  orderBy: OrderBySchema.optional().default([{ field: 'recordCreatedAt', direction: 'desc' }]),
});

export type ListRecordsInput = z.infer<typeof ListRecordsInputSchema>;

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

export type SearchRecordsInput = z.infer<typeof SearchRecordsInputSchema>;
