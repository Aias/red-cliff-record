import { z } from 'zod/v4';
import { DEFAULT_LIMIT, type DbId } from './common';
import {
	IntegrationTypeSchema,
	RecordTypeSchema,
	type LinkSelect,
	type MediaSelect,
	type PredicateSelect,
	type RecordSelect,
} from '@/db/schema';

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
	type: RecordTypeSchema.optional(),
	title: z.string().nullable().optional(),
	text: z.string().nullable().optional(),
	url: z.string().nullable().optional(),
	hasParent: z.boolean().optional(),
	minRating: z.number().int().gte(0).optional(),
	maxRating: z.number().int().lte(3).optional(),
	isPrivate: z.boolean().optional(),
	isCurated: z.boolean().optional(),
	hasReminder: z.boolean().optional(),
	hasEmbedding: z.boolean().optional(),
	hasMedia: z.boolean().optional(),
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
	limit: 50,
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
			recordType: RecordTypeSchema.optional(),
		})
		.optional()
		.default({}),
	limit: LimitSchema.optional().default(10),
});

export type SearchRecordsInput = z.infer<typeof SearchRecordsInputSchema>;

export type RecordGet = Omit<RecordSelect & { media?: MediaSelect[] }, 'textEmbedding'>;

export interface RecordWithRelations extends RecordGet {
	outgoingLinks: Array<LinkSelect & { target: RecordGet; predicate: PredicateSelect }>;
	media: Array<MediaSelect>;
}

export interface FullRecord extends RecordSelect {
	outgoingLinks: Array<LinkSelect & { target: RecordGet; predicate: PredicateSelect }>;
	incomingLinks: Array<LinkSelect & { source: RecordGet; predicate: PredicateSelect }>;
	media: Array<MediaSelect>;
}

export type LinkPartial = Pick<LinkSelect, 'id' | 'sourceId' | 'targetId' | 'predicateId'>;

export type RecordLinks = {
	id: DbId;
	outgoingLinks: LinkPartial[];
	incomingLinks: LinkPartial[];
};

export type RecordLinksMap = Record<DbId, RecordLinks>;
