import type {
	TwitterMediaInsert,
	TwitterTweetInsert,
	TwitterUserInsert,
} from '~/server/db/schema/twitter';
import type { Media, TweetData, User } from './types';

export const processUser = (user: User): Omit<TwitterUserInsert, 'integrationRunId'> => {
	const { rest_id, legacy } = user;
	const {
		created_at,
		description,
		location,
		entities,
		name,
		profile_banner_url,
		profile_image_url_https,
		screen_name,
		url,
	} = legacy;

	// First try entities.url.urls then fallback to entities.description.urls
	let userExternalLinkEntry = entities?.url?.urls?.[0];
	if (!userExternalLinkEntry) {
		userExternalLinkEntry = entities?.description?.urls?.[0];
	}

	return {
		id: rest_id,
		description,
		displayName: name,
		username: screen_name,
		location,
		profileImageUrl: profile_image_url_https,
		profileBannerUrl: profile_banner_url,
		url: url,
		externalUrl: userExternalLinkEntry?.expanded_url,
		contentCreatedAt: new Date(created_at),
	};
};

export const processTweet = (tweet: TweetData): Omit<TwitterTweetInsert, 'integrationRunId'> => {
	const { rest_id, legacy, note_tweet, isQuoted, quotedTweetId } = tweet;
	const { created_at, full_text, user_id_str } = legacy;

	return {
		id: rest_id,
		userId: user_id_str,
		text: note_tweet ? note_tweet.note_tweet_results.result.text : full_text,
		quotedTweetId: isQuoted ? undefined : quotedTweetId,
		contentCreatedAt: new Date(created_at),
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

	return {
		id,
		type,
		tweetUrl,
		mediaUrl: finalMediaUrl,
		thumbnailUrl,
		tweetId: tweet.rest_id,
		contentCreatedAt: new Date(tweet.legacy.created_at),
	};
};
