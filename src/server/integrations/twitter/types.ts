import { z } from 'zod';

// ===============================
// User URL Schemas
// ===============================

export const UserUrlSchema = z.object({
	display_url: z.string(),
	expanded_url: z.string(),
	url: z.string(),
	indices: z.array(z.number()),
});

// ===============================
// User Schemas
// ===============================

export const UserLegacySchema = z.object({
	// Core user identity fields (optional - may be missing for suspended/unavailable accounts)
	created_at: z.string().optional(),
	name: z.string().optional(),
	screen_name: z.string().optional(),
	// Profile fields
	description: z.string().optional(),
	profile_banner_url: z.string().optional(),
	profile_image_url_https: z.string().optional(),
	url: z.string().optional(),
	location: z.string().optional(),
	entities: z
		.object({
			url: z
				.object({
					urls: z.array(UserUrlSchema).optional(),
				})
				.optional(),
			description: z
				.object({
					urls: z.array(UserUrlSchema).optional(),
				})
				.optional(),
		})
		.optional(),
	// Additional fields that may be present
	default_profile: z.boolean().optional(),
	default_profile_image: z.boolean().optional(),
	fast_followers_count: z.number().optional(),
	favourites_count: z.number().optional(),
	followers_count: z.number().optional(),
	friends_count: z.number().optional(),
	has_custom_timelines: z.boolean().optional(),
	is_translator: z.boolean().optional(),
	listed_count: z.number().optional(),
	media_count: z.number().optional(),
	normal_followers_count: z.number().optional(),
	pinned_tweet_ids_str: z.array(z.string()).optional(),
	possibly_sensitive: z.boolean().optional(),
	profile_interstitial_type: z.string().optional(),
	statuses_count: z.number().optional(),
	translator_type: z.string().optional(),
	want_retweets: z.boolean().optional(),
	withheld_in_countries: z.array(z.string()).optional(),
});

export const UserSchema = z.object({
	__typename: z.string(),
	id: z.string(),
	rest_id: z.string(),
	legacy: UserLegacySchema,
	// Additional fields that may be present
	affiliates_highlighted_label: z.unknown().optional(),
	business_account: z.unknown().optional(),
	has_graduated_access: z.boolean().optional(),
	is_blue_verified: z.boolean().optional(),
	profile_image_shape: z.string().optional(),
	super_follow_eligible: z.boolean().optional(),
});

// ===============================
// Media Schemas
// ===============================

export const VideoVariantSchema = z.object({
	bitrate: z.number().optional(),
	content_type: z.string(),
	url: z.string(),
});

export const VideoInfoSchema = z.object({
	aspect_ratio: z.tuple([z.number(), z.number()]),
	duration_millis: z.number().optional(),
	variants: z.array(VideoVariantSchema),
});

export const TwitterMediaTypeSchema = z.enum(['photo', 'video', 'animated_gif']);

export const MediaSchema = z.object({
	display_url: z.string(),
	expanded_url: z.string(),
	id_str: z.string(),
	indices: z.array(z.number()),
	media_key: z.string(),
	media_url_https: z.string(),
	type: TwitterMediaTypeSchema,
	url: z.string(),
	video_info: VideoInfoSchema.optional(),
	// Additional optional fields
	ext_media_availability: z.any().optional(),
	sizes: z.any().optional(),
	original_info: z.any().optional(),
	allow_download_status: z.any().optional(),
	media_results: z.any().optional(),
});

// ===============================
// Note Tweet Schemas
// ===============================

export const NoteTweetSchema = z.object({
	is_expandable: z.boolean(),
	note_tweet_results: z.object({
		result: z.object({
			id: z.string(),
			text: z.string(),
			entity_set: z.object({
				hashtags: z.array(z.any()),
				symbols: z.array(z.any()),
				urls: z.array(z.any()),
				user_mentions: z.array(z.any()),
			}),
			richtext: z
				.object({
					richtext_tags: z.array(z.any()),
				})
				.optional(),
			media: z
				.object({
					inline_media: z.array(z.any()),
				})
				.optional(),
		}),
	}),
});

// ===============================
// Tweet Schemas
// ===============================

export const TweetLegacySchema = z.object({
	created_at: z.string(),
	full_text: z.string(),
	user_id_str: z.string(),
	id_str: z.string(),
	// Optional fields that may be present
	bookmark_count: z.number().optional(),
	bookmarked: z.boolean().optional(),
	conversation_control: z.any().optional(),
	conversation_id_str: z.string().optional(),
	in_reply_to_status_id_str: z.string().optional(),
	in_reply_to_user_id_str: z.string().optional(),
	in_reply_to_screen_name: z.string().optional(),
	display_text_range: z.array(z.number()).optional(),
	entities: z
		.object({
			hashtags: z.array(z.any()).optional(),
			media: z.array(MediaSchema).optional(),
			symbols: z.array(z.any()).optional(),
			timestamps: z.array(z.any()).optional(),
			urls: z.array(z.any()).optional(),
			user_mentions: z.array(z.any()).optional(),
		})
		.optional(),
	extended_entities: z
		.object({
			media: z.array(MediaSchema).optional(),
		})
		.optional(),
	favorite_count: z.number().optional(),
	favorited: z.boolean().optional(),
	is_quote_status: z.boolean().optional(),
	lang: z.string().optional(),
	possibly_sensitive: z.boolean().optional(),
	quoted_status_id_str: z.string().optional(),
	quoted_status_permalink: z
		.object({
			url: z.string(),
			expanded: z.string(),
			display: z.string(),
		})
		.optional(),
	reply_count: z.number().optional(),
	retweet_count: z.number().optional(),
	retweeted: z.boolean().optional(),
	possibly_sensitive_editable: z.boolean().optional(),
	quote_count: z.number().optional(),
});

// Simplified approach - avoid recursive references for now
export const TweetDataSchema = z.object({
	rest_id: z.string(),
	isQuoted: z.boolean().optional(),
	quotedTweetId: z.string().optional(),
	core: z.object({
		user_results: z.object({
			result: UserSchema,
		}),
	}),
	note_tweet: NoteTweetSchema.optional(),
	legacy: TweetLegacySchema,
	// For quoted tweets, we'll just use any for now to avoid recursion
	quoted_status_result: z
		.object({
			result: z.any(),
		})
		.optional(),
	// Additional fields from the API
	unmention_data: z.any().optional(),
	edit_control: z.any().optional(),
	previous_counts: z.any().optional(),
	is_translatable: z.boolean().optional(),
	views: z.any().optional(),
	source: z.string().optional(),
	grok_analysis_button: z.boolean().optional(),
});

export const TweetSchema = z
	.object({
		__typename: z.literal('Tweet'),
	})
	.extend(TweetDataSchema.shape);

export const TweetWithVisibilityResultsSchema = z.object({
	__typename: z.literal('TweetWithVisibilityResults'),
	tweet: TweetDataSchema,
	limitedActionResults: z.object({
		limited_actions: z.array(z.any()),
	}),
});

// ===============================
// Timeline Schemas
// ===============================

export const TimelineCursorSchema = z.object({
	__typename: z.literal('TimelineTimelineCursor'),
	cursorType: z.string().optional(),
	value: z.string().optional(),
});

export const TweetTombstoneSchema = z.object({
	__typename: z.literal('TweetTombstone'),
});

export const TimelineItemSchema = z.union([
	TimelineCursorSchema,
	TweetSchema,
	TweetWithVisibilityResultsSchema,
	TweetTombstoneSchema,
]);

export const TwitterBookmarkSchema = z.object({
	entryId: z.string().optional(),
	sortIndex: z.string().optional(),
	content: z.object({
		__typename: z.string(),
		entryType: z.string().optional(),
		itemContent: z
			.object({
				tweet_results: z.object({
					result: TimelineItemSchema,
				}),
				itemType: z.string().optional(),
				__typename: z.string().optional(),
			})
			.optional(),
	}),
});

export const InstructionSchema = z.object({
	type: z.string(),
	entries: z.array(TwitterBookmarkSchema),
});

export const TwitterBookmarkResponseSchema = z.object({
	url: z.string(),
	timestamp: z.string(),
	response: z.object({
		data: z.object({
			bookmark_timeline_v2: z.object({
				timeline: z.object({
					instructions: z.array(InstructionSchema),
				}),
			}),
		}),
	}),
});

export const TwitterBookmarksArraySchema = z.array(TwitterBookmarkResponseSchema);

// ===============================
// Inferred Types
// ===============================

export type UserUrl = z.infer<typeof UserUrlSchema>;
export type UserLegacy = z.infer<typeof UserLegacySchema>;
export type User = z.infer<typeof UserSchema>;

export type VideoVariant = z.infer<typeof VideoVariantSchema>;
export type VideoInfo = z.infer<typeof VideoInfoSchema>;
export type TwitterMediaType = z.infer<typeof TwitterMediaTypeSchema>;
export type Media = z.infer<typeof MediaSchema>;

export type NoteTweet = z.infer<typeof NoteTweetSchema>;
export type TweetLegacy = z.infer<typeof TweetLegacySchema>;
export type TweetData = z.infer<typeof TweetDataSchema>;
export type Tweet = z.infer<typeof TweetSchema>;
export type TweetWithVisibilityResults = z.infer<typeof TweetWithVisibilityResultsSchema>;

export type TimelineCursor = z.infer<typeof TimelineCursorSchema>;
export type TweetTombstone = z.infer<typeof TweetTombstoneSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export type TwitterBookmark = z.infer<typeof TwitterBookmarkSchema>;
export type Instruction = z.infer<typeof InstructionSchema>;
export type TwitterBookmarkResponse = z.infer<typeof TwitterBookmarkResponseSchema>;
export type TwitterBookmarksArray = z.infer<typeof TwitterBookmarksArraySchema>;

// ===============================
// Raw API Response Schema
// ===============================

/**
 * Schema for the raw GraphQL API response from Twitter's Bookmarks endpoint.
 * This matches the actual API response before any transformation.
 */
const RawBookmarkEntryContentSchema = z.object({
	__typename: z.string(),
	cursorType: z.string().optional(),
	value: z.string().optional(),
	entryType: z.string().optional(),
	itemContent: z
		.object({
			itemType: z.string().optional(),
			__typename: z.string().optional(),
			tweet_results: z
				.object({
					result: z.unknown(),
				})
				.optional(),
		})
		.optional(),
});

const RawBookmarkEntrySchema = z.object({
	entryId: z.string().optional(),
	sortIndex: z.string().optional(),
	content: RawBookmarkEntryContentSchema,
});

const RawBookmarkInstructionSchema = z.object({
	type: z.string().optional(),
	entries: z.array(RawBookmarkEntrySchema).optional(),
});

export const RawBookmarksApiResponseSchema = z.object({
	data: z
		.object({
			bookmark_timeline_v2: z
				.object({
					timeline: z
						.object({
							instructions: z.array(RawBookmarkInstructionSchema).optional(),
						})
						.optional(),
				})
				.optional(),
		})
		.optional(),
	errors: z
		.array(
			z.object({
				message: z.string(),
			})
		)
		.optional(),
});

export type RawBookmarksApiResponse = z.infer<typeof RawBookmarksApiResponseSchema>;
export type RawBookmarkEntry = z.infer<typeof RawBookmarkEntrySchema>;

// ===============================
// Type Guards
// ===============================

/** Type guard to check if a TimelineItem is a Tweet */
export function isTweet(item: TimelineItem): item is Tweet {
	return item.__typename === 'Tweet';
}

/** Type guard to check if a TimelineItem is a TweetWithVisibilityResults */
export function isTweetWithVisibilityResults(
	item: TimelineItem
): item is TweetWithVisibilityResults {
	return item.__typename === 'TweetWithVisibilityResults';
}

/** Type guard to check if a TimelineItem is a TimelineCursor */
export function isTimelineCursor(item: TimelineItem): item is TimelineCursor {
	return item.__typename === 'TimelineTimelineCursor';
}

/** Type guard to check if a TimelineItem is a TweetTombstone */
export function isTweetTombstone(item: TimelineItem): item is TweetTombstone {
	return item.__typename === 'TweetTombstone';
}

/**
 * Extracts the tweet ID from a TimelineItem if it's a tweet type.
 * Returns undefined for cursors and tombstones.
 */
export function extractTweetId(item: TimelineItem): string | undefined {
	if (isTweet(item)) {
		return item.rest_id;
	}
	if (isTweetWithVisibilityResults(item)) {
		return item.tweet.rest_id;
	}
	return undefined;
}

/**
 * Safely parses an unknown value as a TimelineItem.
 * Returns undefined if parsing fails.
 */
export function parseTimelineItem(value: unknown): TimelineItem | undefined {
	const result = TimelineItemSchema.safeParse(value);
	return result.success ? result.data : undefined;
}
