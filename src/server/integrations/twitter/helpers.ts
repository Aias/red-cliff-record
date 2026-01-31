import type { TwitterMediaInsert, TwitterTweetInsert, TwitterUserInsert } from '@hozo';
import type { Media, TweetData, UrlEntity, User } from './types';

/**
 * Process a Twitter user into database format.
 * Returns null if the user has missing required fields (e.g., suspended/unavailable accounts).
 */
export const processUser = (user: User): Omit<TwitterUserInsert, 'integrationRunId'> | null => {
  const { rest_id, legacy, core, avatar, location: userLocation, profile_bio } = user;
  const name = core?.name ?? legacy.name;
  const screenName = core?.screen_name ?? legacy.screen_name;
  const createdAt = core?.created_at ?? legacy.created_at;
  const description = legacy.description ?? profile_bio?.description;
  const location = legacy.location ?? userLocation?.location ?? null;
  const profileImageUrl = legacy.profile_image_url_https ?? avatar?.image_url ?? null;
  const { entities, profile_banner_url, url } = legacy;

  // Skip users with missing required fields (suspended/unavailable accounts)
  if (!screenName || !name) {
    return null;
  }

  // First try entities.url.urls then fallback to entities.description.urls
  let userExternalLinkEntry = entities?.url?.urls?.[0];
  if (!userExternalLinkEntry) {
    userExternalLinkEntry = entities?.description?.urls?.[0];
  }

  // Safely parse the creation date with fallback to null
  let contentCreatedAt: Date | null = null;
  if (createdAt) {
    const parsedDate = new Date(createdAt);
    contentCreatedAt = isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return {
    id: rest_id,
    description,
    displayName: name,
    username: screenName,
    location,
    profileImageUrl,
    profileBannerUrl: profile_banner_url,
    url: url,
    externalUrl: userExternalLinkEntry?.expanded_url,
    contentCreatedAt,
  };
};

/**
 * Expands t.co URLs in text using URL entities.
 * Replaces shortened URLs with their expanded forms using character indices.
 */
function expandUrls(text: string, urls: UrlEntity[] | undefined): string {
  if (!urls || urls.length === 0) return text;

  // Sort by start index descending so replacements don't shift subsequent indices
  const sortedUrls = [...urls].sort((a, b) => b.indices[0] - a.indices[0]);

  let result = text;
  for (const { url, expanded_url, indices } of sortedUrls) {
    const [start, end] = indices;
    // Verify the t.co URL at the expected position (handles edge cases)
    if (result.slice(start, end) === url) {
      result = result.slice(0, start) + expanded_url + result.slice(end);
    }
  }

  return result;
}

export const processTweet = (tweet: TweetData): Omit<TwitterTweetInsert, 'integrationRunId'> => {
  const { rest_id, legacy, note_tweet, isQuoted, quotedTweetId } = tweet;
  const { created_at, full_text, user_id_str, in_reply_to_status_id_str, conversation_id_str } =
    legacy;

  // Safely parse the creation date with fallback to null
  let contentCreatedAt: Date | null = null;
  if (created_at) {
    const parsedDate = new Date(created_at);
    contentCreatedAt = isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  // Get text and URL entities (note_tweet uses entity_set, regular tweets use legacy.entities)
  const rawText = note_tweet ? note_tweet.note_tweet_results.result.text : full_text;
  const urlEntities = note_tweet
    ? note_tweet.note_tweet_results.result.entity_set.urls
    : legacy.entities?.urls;
  const text = expandUrls(rawText, urlEntities);

  return {
    id: rest_id,
    userId: user_id_str,
    text,
    quotedTweetId: isQuoted ? undefined : quotedTweetId,
    inReplyToTweetId: in_reply_to_status_id_str,
    conversationId: conversation_id_str,
    contentCreatedAt,
  };
};

export const processMedia = (
  media: Media,
  tweet: TweetData
): Omit<TwitterMediaInsert, 'integrationRunId'> => {
  const { display_url: tweetUrl, id_str: id, type, media_url_https, video_info } = media;

  let finalMediaUrl = media_url_https;
  const thumbnailUrl = media_url_https;

  // When the media is a video or an animated GIF, attempt to select an mp4 variant.
  if (
    (type === 'video' || type === 'animated_gif') &&
    video_info &&
    Array.isArray(video_info.variants)
  ) {
    // Filter for mp4 variants (animated_gif variants often include a bitrate of 0).
    const mp4Variants = video_info.variants.filter(
      (variant) => variant.content_type === 'video/mp4'
    );
    if (mp4Variants.length > 0) {
      if (type === 'video') {
        // For videos, sort descending by bitrate.
        mp4Variants.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      }
      // For animated GIFs, just take the (only) variant provided.
      finalMediaUrl = mp4Variants[0]?.url ?? media_url_https;
    }
  }

  // Safely parse the creation date with fallback to null
  let contentCreatedAt: Date | null = null;
  if (tweet.legacy.created_at) {
    const parsedDate = new Date(tweet.legacy.created_at);
    contentCreatedAt = isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return {
    id,
    type,
    tweetUrl,
    mediaUrl: finalMediaUrl,
    thumbnailUrl,
    tweetId: tweet.rest_id,
    contentCreatedAt,
  };
};
