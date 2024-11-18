import type { Media, TweetData, User } from './types';

export const processUser = (user: User) => {
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
		url
	} = legacy;

	const userExternalLink = entities?.url?.urls?.[0];

	return {
		id: rest_id,
		description,
		displayName: name,
		username: screen_name,
		location,
		profileImageUrl: profile_image_url_https,
		profileBannerUrl: profile_banner_url,
		twitterUrl: url,
		userExternalLink,
		createdAt: created_at
	};
};

export const processTweet = (tweet: TweetData) => {
	const { rest_id, legacy, note_tweet, isQuoted, quotedTweetId } = tweet;
	const { created_at, full_text, user_id_str } = legacy;

	return {
		id: rest_id,
		userId: user_id_str,
		text: note_tweet ? note_tweet.note_tweet_results.result.text : full_text,
		quotedTweetId: isQuoted ? undefined : quotedTweetId,
		createdAt: created_at
	};
};

export const processMedia = (media: Media, tweet: TweetData) => {
	const { display_url, expanded_url, id_str, type, url, media_key, media_url_https } = media;

	return {
		id: id_str,
		mediaUrl: media_url_https,
		displayUrl: display_url,
		expandedUrl: expanded_url,
		type,
		shortUrl: url,
		mediaKey: media_key,
		tweetId: tweet.rest_id
	};
};
