/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TwitterBookmarkResponse {
	url: string;
	timestamp: string;
	response: {
		data: {
			bookmark_timeline_v2: {
				timeline: {
					instructions: Instruction[];
				};
			};
		};
	};
}

export interface Instruction {
	type: string;
	entries: TwitterBookmark[];
}

export type TwitterBookmark = {
	content: {
		__typename: string;
		itemContent: {
			tweet_results: {
				result: TimelineItem;
			};
		};
	};
};

export type TimelineItem = TimelineCursor | Tweet | TweetWithVisibilityResults;

export type TweetTombstone = {
	__typename: 'TweetTombstone';
};

export type TimelineCursor = {
	__typename: 'TimelineTimelineCursor';
};

export type Tweet = {
	__typename: 'Tweet';
} & TweetData;

export type TweetWithVisibilityResults = {
	__typename: 'TweetWithVisibilityResults';
	tweet: TweetData;
	limitedActionResults: {
		limited_actions: any[];
	};
};

export type TweetData = {
	rest_id: string;
	isQuoted?: boolean;
	quotedTweetId?: string;
	core: {
		user_results: {
			result: User;
		};
	};
	quoted_status_result?: {
		result: Tweet | TweetWithVisibilityResults;
	};
	note_tweet?: NoteTweet;
	legacy: TweetLegacy;
};

export type User = {
	__typename: string;
	id: string;
	rest_id: string;
	legacy: UserLegacy;
};

export type UserLegacy = {
	created_at: string;
	description?: string;
	location?: string;
	name: string;
	profile_banner_url?: string;
	profile_image_url_https?: string;
	screen_name: string;
	url: string;
	entities: {
		url?: {
			urls?: UserUrl[];
		};
		description?: {
			urls?: UserUrl[];
		};
	};
};

export type UserUrl = {
	display_url: string;
	expanded_url: string;
	url: string;
	indices: number[];
};

export type NoteTweet = {
	is_expandable: boolean;
	note_tweet_results: {
		result: {
			id: string;
			text: string;
			entity_set: {
				hashtags: any[];
				symbols: any[];
				urls: any[];
				user_mentions: any[];
			};
		};
	};
};

export type TweetLegacy = {
	bookmark_count: number;
	bookmarked: boolean;
	created_at: string;
	conversation_control: any;
	conversation_id_str: string;
	display_text_range: number[];
	entities: {
		hashtags?: any[];
		media?: Media[];
		symbols?: any[];
		timestamps?: any[];
		urls?: any[];
		user_mentions?: any[];
	};
	extended_entities?: {
		media?: Media[];
	};
	favorite_count: number;
	favorited: boolean;
	full_text: string;
	is_quote_status: boolean;
	lang: string;
	possibly_sensitive: boolean;
	quoted_status_id_str: string;
	quoted_status_permalink: {
		url: string;
		expanded: string;
		display: string;
	};
	reply_count: number;
	retweet_count: number;
	retweeted: boolean;
	user_id_str: string;
	id_str: string;
};

export type VideoVariant = {
	bitrate?: number;
	content_type: string;
	url: string;
};

export type VideoInfo = {
	aspect_ratio: [number, number];
	duration_millis: number;
	variants: VideoVariant[];
};

export type TwitterMediaType = 'photo' | 'video' | 'animated_gif';

export type Media = {
	display_url: string;
	expanded_url: string;
	id_str: string;
	indices: number[];
	media_key: string;
	media_url_https: string;
	type: TwitterMediaType;
	url: string;
	video_info?: VideoInfo;
};

export type TwitterBookmarksArray = TwitterBookmarkResponse[];
