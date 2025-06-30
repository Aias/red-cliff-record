import { z } from 'zod/v4';
import { emptyStringToNull } from '@/shared/lib/formatting';

/**
 * Subscription (Feed) Schema
 */
export const FeedbinSubscriptionSchema = z.object({
	id: z.number().int().positive(),
	created_at: z.coerce.date(),
	feed_id: z.number().int().positive(),
	title: z.string(),
	feed_url: z.url(),
	site_url: z.url().nullable(),
});

export const FeedbinSubscriptionsResponseSchema = z.array(FeedbinSubscriptionSchema);

/**
 * Feed Schema
 */
export const FeedbinFeedSchema = z.object({
	id: z.number().int().positive(),
	title: z.string(),
	feed_url: z.url(),
	site_url: z.url().nullable(),
});

/**
 * URL components that Feedbin sometimes returns instead of a string URL
 */
const UrlComponentsSchema = z.object({
	scheme: z.string(),
	user: z.string().nullable().optional(),
	password: z.string().nullable().optional(),
	host: z.string(),
	port: z.number().nullable().optional(),
	path: z.string(),
	query: z.string().nullable().optional(),
	fragment: z.string().nullable().optional(),
});

/**
 * Enclosure Schema for podcast/media attachments
 * Note: Feedbin sometimes returns URL components as objects instead of strings
 * and enclosure_type can be "false" string or other invalid values
 */
export const FeedbinEnclosureSchema = z.object({
	enclosure_url: z.union([z.string(), UrlComponentsSchema]).optional().nullable(),
	enclosure_type: z.union([z.string(), z.boolean()]).optional().nullable(),
	enclosure_length: z.union([z.coerce.number(), z.string()]).optional().nullable(),
	itunes_duration: z.string().optional().nullable(),
	itunes_image: z.union([z.string(), UrlComponentsSchema]).optional().nullable(),
});

/**
 * Entry Schema
 */
export const FeedbinEntrySchema = z.object({
	id: z.number().int().positive(),
	feed_id: z.number().int().positive(),
	title: emptyStringToNull(z.string()),
	url: z.url(),
	extracted_content_url: z.url().optional(),
	author: emptyStringToNull(z.string()),
	content: emptyStringToNull(z.string()),
	summary: emptyStringToNull(z.string()),
	published: z.coerce.date(),
	created_at: z.coerce.date(),
	// Extended mode fields
	enclosure: FeedbinEnclosureSchema.optional().nullable(),
	images: z
		.object({
			original_url: z.url(),
			size_1: z
				.object({
					cdn_url: z.url(),
					width: z.number().int().positive(),
					height: z.number().int().positive(),
				})
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
	twitter_id: z.number().nullable().optional(),
	twitter_thread_ids: z.array(z.number()).nullable().optional(),
});

export const FeedbinEntriesResponseSchema = z.array(FeedbinEntrySchema);

/**
 * Entry IDs Response Schema (for unread, starred, recently read endpoints)
 */
export const FeedbinEntryIdsResponseSchema = z.array(z.number().int().positive());

/**
 * Icon Schema
 */
export const FeedbinIconSchema = z.object({
	host: z.string(),
	url: z.url(),
});

export const FeedbinIconsResponseSchema = z.array(FeedbinIconSchema);

/**
 * Pagination Link Header Parser
 */
export interface PaginationLinks {
	first?: string;
	prev?: string;
	next?: string;
	last?: string;
}

export function parseLinkHeader(linkHeader: string | null): PaginationLinks {
	if (!linkHeader) return {};

	const links: PaginationLinks = {};
	const parts = linkHeader.split(',');

	for (const part of parts) {
		const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
		if (match) {
			const [, url, rel] = match;
			if (rel === 'first' || rel === 'prev' || rel === 'next' || rel === 'last') {
				links[rel] = url;
			}
		}
	}

	return links;
}

/**
 * Type exports
 */
export type FeedbinSubscription = z.infer<typeof FeedbinSubscriptionSchema>;
export type FeedbinFeed = z.infer<typeof FeedbinFeedSchema>;
export type FeedbinEntry = z.infer<typeof FeedbinEntrySchema>;
export type FeedbinEnclosure = z.infer<typeof FeedbinEnclosureSchema>;
export type FeedbinIcon = z.infer<typeof FeedbinIconSchema>;
