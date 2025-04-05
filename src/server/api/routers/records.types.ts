import { z } from 'zod';
import { DEFAULT_LIMIT, IdSchema } from './common';
import { IntegrationTypeSchema, RecordTypeSchema } from '@/db/schema';

const OrderByFieldSchema = z.enum([
	'recordUpdatedAt',
	'recordCreatedAt',
	'title',
	'contentCreatedAt',
	'contentUpdatedAt',
	'rating',
	'childOrder',
	'id',
]);

const OrderDirectionSchema = z.enum(['asc', 'desc']);

export const OrderCriteriaSchema = z.object({
	field: OrderByFieldSchema,
	direction: OrderDirectionSchema.optional().default('desc'),
});

export const RecordFiltersSchema = z.object({
	type: RecordTypeSchema.optional(),
	title: z.string().nullable().optional(),
	creatorId: IdSchema.nullable().optional(),
	formatId: IdSchema.nullable().optional(),
	url: z.string().nullable().optional(),
	parentId: IdSchema.nullable().optional(),
	minRating: z.number().int().gte(0).optional(),
	maxRating: z.number().int().lte(3).optional(),
	isIndexNode: z.boolean().optional(),
	isFormat: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isCurated: z.boolean().optional(),
	hasReminder: z.boolean().optional(),
	source: IntegrationTypeSchema.optional(),
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

export const defaultQueueOptions: ListRecordsInput = {
	filters: {},
	limit: 200,
	offset: 0,
	orderBy: [
		{
			field: 'recordCreatedAt',
			direction: 'desc',
		},
		{
			field: 'id',
			direction: 'desc',
		},
	],
};

export const SearchRecordsInputSchema = z.object({
	query: z.string(),
	filters: z
		.object({
			isFormat: z.boolean().optional(),
			isIndexNode: z.boolean().optional(),
		})
		.optional()
		.default({}),
	limit: LimitSchema.optional().default(10),
});

export type SearchRecordsInput = z.infer<typeof SearchRecordsInputSchema>;
