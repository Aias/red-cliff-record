import { emptyStringToNull } from '@hozo';
import { z } from 'zod';
import { flexibleUrl } from '@/server/lib/url-utils';

const FeedbinSubscriptionSchema = z.object({
  id: z.number().int().positive(),
  created_at: z.coerce.date(),
  feed_id: z.number().int().positive(),
  title: z.string(),
  feed_url: z.url(),
  site_url: flexibleUrl,
});

export const FeedbinSubscriptionsResponseSchema = z.array(FeedbinSubscriptionSchema);

export const FeedbinFeedSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  feed_url: z.url(),
  site_url: flexibleUrl,
});

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

const FeedbinEnclosureSchema = z.object({
  enclosure_url: z.xor([z.string(), UrlComponentsSchema]).optional().nullable(),
  enclosure_type: z.xor([z.string(), z.boolean()]).optional().nullable(),
  enclosure_length: z.union([z.coerce.number(), z.string()]).optional().nullable(),
  itunes_duration: z.string().optional().nullable(),
  itunes_image: z.xor([z.string(), UrlComponentsSchema]).optional().nullable(),
});

const FeedbinEntrySchema = z.object({
  id: z.number().int().positive(),
  feed_id: z.number().int().positive(),
  title: emptyStringToNull(z.string()),
  url: flexibleUrl,
  extracted_content_url: flexibleUrl.optional(),
  author: emptyStringToNull(z.string()),
  content: emptyStringToNull(z.string()),
  summary: emptyStringToNull(z.string()),
  published: z.coerce.date(),
  created_at: z.coerce.date(),
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

export const FeedbinEntryIdsResponseSchema = z.array(z.number().int().positive());

const FeedbinIconSchema = z.object({
  host: z.string(),
  url: z.url(),
});

export const FeedbinIconsResponseSchema = z.array(FeedbinIconSchema);

export type FeedbinSubscription = z.infer<typeof FeedbinSubscriptionSchema>;
export type FeedbinEntry = z.infer<typeof FeedbinEntrySchema>;
