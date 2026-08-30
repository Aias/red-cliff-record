import { z } from 'zod';

const UrlEntitySchema = z.object({
  display_url: z.string(),
  expanded_url: z.string(),
  url: z.string(),
  indices: z.tuple([z.number(), z.number()]),
});

const UserLegacySchema = z.object({
  created_at: z.string().optional(),
  name: z.string().optional(),
  screen_name: z.string().optional(),
  description: z.string().optional(),
  profile_banner_url: z.string().optional(),
  profile_image_url_https: z.string().optional(),
  url: z.string().optional(),
  location: z.string().optional(),
  entities: z
    .object({
      url: z
        .object({
          urls: z.array(UrlEntitySchema).optional(),
        })
        .optional(),
      description: z
        .object({
          urls: z.array(UrlEntitySchema).optional(),
        })
        .optional(),
    })
    .optional(),
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

const UserSchema = z.object({
  __typename: z.string(),
  id: z.string(),
  rest_id: z.string(),
  avatar: z
    .object({
      image_url: z.string().optional(),
    })
    .optional(),
  core: z
    .object({
      created_at: z.string().optional(),
      name: z.string().optional(),
      screen_name: z.string().optional(),
    })
    .optional(),
  legacy: UserLegacySchema,
  location: z
    .object({
      location: z.string().optional(),
    })
    .optional(),
  affiliates_highlighted_label: z.unknown().optional(),
  business_account: z.unknown().optional(),
  has_graduated_access: z.boolean().optional(),
  is_blue_verified: z.boolean().optional(),
  profile_bio: z
    .object({
      description: z.string().optional(),
    })
    .optional(),
  profile_image_shape: z.string().optional(),
  super_follow_eligible: z.boolean().optional(),
});

const VideoVariantSchema = z.object({
  bitrate: z.number().optional(),
  content_type: z.string(),
  url: z.string(),
});

const VideoInfoSchema = z.object({
  aspect_ratio: z.tuple([z.number(), z.number()]),
  duration_millis: z.number().optional(),
  variants: z.array(VideoVariantSchema),
});

const TwitterMediaTypeSchema = z.enum(['photo', 'video', 'animated_gif']);

const MediaSchema = z.object({
  display_url: z.string(),
  expanded_url: z.string(),
  id_str: z.string(),
  indices: z.array(z.number()),
  media_key: z.string(),
  media_url_https: z.string(),
  type: TwitterMediaTypeSchema,
  url: z.string(),
  video_info: VideoInfoSchema.optional(),
  ext_media_availability: z.any().optional(),
  sizes: z.any().optional(),
  original_info: z.any().optional(),
  allow_download_status: z.any().optional(),
  media_results: z.any().optional(),
});

const NoteTweetSchema = z.object({
  is_expandable: z.boolean(),
  note_tweet_results: z.object({
    result: z.object({
      id: z.string(),
      text: z.string(),
      entity_set: z.object({
        hashtags: z.array(z.any()),
        symbols: z.array(z.any()),
        urls: z.array(UrlEntitySchema),
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

const TweetLegacySchema = z.object({
  created_at: z.string(),
  full_text: z.string(),
  user_id_str: z.string(),
  id_str: z.string(),
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
      urls: z.array(UrlEntitySchema).optional(),
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

const TweetDataSchema = z.object({
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
  quoted_status_result: z
    .object({
      result: z.any(),
    })
    .optional(),
  unmention_data: z.any().optional(),
  edit_control: z.any().optional(),
  previous_counts: z.any().optional(),
  is_translatable: z.boolean().optional(),
  views: z.any().optional(),
  source: z.string().optional(),
  grok_analysis_button: z.boolean().optional(),
});

const TweetSchema = z
  .object({
    __typename: z.literal('Tweet'),
  })
  .extend(TweetDataSchema.shape);

const TweetWithVisibilityResultsSchema = z.object({
  __typename: z.literal('TweetWithVisibilityResults'),
  tweet: TweetDataSchema,
  limitedActionResults: z.object({
    limited_actions: z.array(z.any()),
  }),
});

const TimelineCursorSchema = z.object({
  __typename: z.literal('TimelineTimelineCursor'),
  cursorType: z.string().optional(),
  value: z.string().optional(),
});

const TweetTombstoneSchema = z.object({
  __typename: z.literal('TweetTombstone'),
});

export const TimelineItemSchema = z.union([
  TimelineCursorSchema,
  TweetSchema,
  TweetWithVisibilityResultsSchema,
  TweetTombstoneSchema,
]);

export type UrlEntity = z.infer<typeof UrlEntitySchema>;
export type User = z.infer<typeof UserSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type TweetData = z.infer<typeof TweetDataSchema>;
export type Tweet = z.infer<typeof TweetSchema>;
export type TweetWithVisibilityResults = z.infer<typeof TweetWithVisibilityResultsSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

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

export const TweetDetailEnvelopeSchema = z.object({
  data: z
    .object({
      tweetResult: z
        .object({
          result: z.unknown().optional(),
        })
        .optional(),
      threaded_conversation_with_injections_v2: z
        .object({
          instructions: z
            .array(
              z.object({
                entries: z
                  .array(
                    z.object({
                      content: z
                        .object({
                          itemContent: z
                            .object({
                              tweet_results: z
                                .object({
                                  result: z.unknown().optional(),
                                })
                                .optional(),
                            })
                            .optional(),
                        })
                        .optional(),
                    })
                  )
                  .optional(),
              })
            )
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

export function isTweet(item: TimelineItem): item is Tweet {
  return item.__typename === 'Tweet';
}

export function isTweetWithVisibilityResults(
  item: TimelineItem
): item is TweetWithVisibilityResults {
  return item.__typename === 'TweetWithVisibilityResults';
}

export function extractTweetId(item: TimelineItem): string | undefined {
  if (isTweet(item)) {
    return item.rest_id;
  }
  if (isTweetWithVisibilityResults(item)) {
    return item.tweet.rest_id;
  }
  return undefined;
}
