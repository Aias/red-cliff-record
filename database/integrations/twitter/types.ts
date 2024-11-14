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

export interface QuotedTweetWithVisibilityResults {
	__typename: 'TweetWithVisibilityResults';
	tweet: Tweet;
	limitedActionResults: {
		limited_actions: Array<{
			action: string;
			prompt: {
				__typename: string;
				cta_type: string;
				headline: {
					text: string;
					entities: any[];
				};
				subtext: {
					text: string;
					entities: any[];
				};
			};
		}>;
	};
}

export interface TwitterBookmark {
	entryId: string;
	sortIndex: string;
	content: {
		entryType: string;
		__typename: string;
		itemContent: {
			itemType: string;
			__typename: string;
			tweet_results: {
				result: Tweet | TweetWithVisibilityResults;
			};
			tweetDisplayType: string;
		};
	};
}

export interface TweetWithVisibilityResults {
	__typename: 'TweetWithVisibilityResults';
	tweet: Tweet;
}

export interface Tweet {
	__typename: 'Tweet';
	rest_id: string;
	core: {
		user_results: {
			result: User;
		};
	};
	unmention_data: {};
	edit_control: EditControl;
	is_translatable: boolean;
	views: Views;
	source: string;
	legacy: TweetLegacy;
	note_tweet?: {
		is_expandable: boolean;
		note_tweet_results: {
			result: NoteTweet;
		};
	};
	quoted_status_result?: {
		result:
			| Tweet
			| TweetTombstone
			| {
					quotedTweet: QuotedTweetWithVisibilityResults;
			  };
	};
}

export interface EditControl {
	edit_tweet_ids: string[];
	editable_until_msecs: string;
	is_edit_eligible: boolean;
	edits_remaining: string;
	edit_control_initial?: {
		edit_tweet_ids: string[];
		editable_until_msecs: string;
		is_edit_eligible: boolean;
		edits_remaining: string;
	};
}

export interface Views {
	count: string;
	state: string;
}

export interface TweetLegacy {
	bookmark_count: number;
	bookmarked: boolean;
	created_at: string;
	conversation_id_str: string;
	display_text_range: number[];
	entities: Entities;
	extended_entities?: EntitiesExtended;
	favorite_count: number;
	favorited: boolean;
	full_text: string;
	is_quote_status: boolean;
	lang: string;
	possibly_sensitive?: boolean;
	possibly_sensitive_editable?: boolean;
	quote_count: number;
	reply_count: number;
	retweet_count: number;
	retweeted: boolean;
	user_id_str: string;
	id_str: string;
	in_reply_to_screen_name?: string;
	in_reply_to_status_id_str?: string;
	in_reply_to_user_id_str?: string;
	quoted_status_id_str?: string;
	quoted_status_permalink?: {
		url: string;
		expanded: string;
		display: string;
	};
	previous_counts?: {
		bookmark_count: number;
		favorite_count: number;
		quote_count: number;
		reply_count: number;
		retweet_count: number;
	};
}

export interface Entities {
	hashtags: [];
	media: Media[];
	symbols: [];
	timestamps: [];
	urls: Url[];
	user_mentions: UserMention[];
}

export interface EntitiesExtended {
	media: Media[];
}

export interface Media {
	display_url: string;
	expanded_url: string;
	id_str: string;
	indices: number[];
	media_key: string;
	media_url_https: string;
	type: string;
	url: string;
	additional_media_info?: {
		monetizable: boolean;
	};
	ext_media_availability?: {
		status: string;
	};
	sizes: Sizes;
	original_info?: {
		height: number;
		width: number;
		focus_rects: [];
	};
	allow_download_status?: {
		allow_download: boolean;
	};
	video_info?: {
		aspect_ratio: number[];
		duration_millis: number;
		variants: Variant[];
	};
	ext_alt_text?: string;
	features?: {
		large: {
			faces: [];
		};
		medium: {
			faces: [];
		};
		small: {
			faces: [];
		};
		orig: {
			faces: [];
		};
	};
	media_results?: {
		result: {
			media_key: string;
		};
	};
}

export interface Sizes {
	large: Size;
	medium: Size;
	small: Size;
	thumb: Size;
}

export interface Size {
	h: number;
	w: number;
	resize: string;
}

export interface Variant {
	content_type: string;
	url: string;
	bitrate?: number;
}

export interface Url {
	display_url: string;
	expanded_url: string;
	url: string;
	indices: number[];
}

export interface UserMention {
	id_str: string;
	name: string;
	screen_name: string;
	indices: number[];
}

export interface User {
	__typename: string;
	id: string;
	rest_id: string;
	affiliates_highlighted_label: AffiliatesHighlightedLabel;
	has_graduated_access: boolean;
	is_blue_verified: boolean;
	profile_image_shape: string;
	legacy: UserLegacy;
	professional?: Professional;
	tipjar_settings: {};
}

export interface AffiliatesHighlightedLabel {
	label?: {
		url?: {
			url: string;
			urlType: string;
		};
		badge?: {
			url: string;
		};
		description: string;
		userLabelType: string;
		userLabelDisplayType: string;
	};
}

export interface UserLegacy {
	following: boolean;
	can_dm: boolean;
	can_media_tag: boolean;
	created_at: string;
	default_profile: boolean;
	default_profile_image: boolean;
	description: string;
	entities: UserEntities;
	fast_followers_count: number;
	favourites_count: number;
	followers_count: number;
	friends_count: number;
	has_custom_timelines: boolean;
	is_translator: boolean;
	listed_count: number;
	location: string;
	media_count: number;
	name: string;
	normal_followers_count: number;
	pinned_tweet_ids_str: string[];
	possibly_sensitive: boolean;
	profile_banner_url: string;
	profile_image_url_https: string;
	profile_interstitial_type: string;
	screen_name: string;
	statuses_count: number;
	translator_type: string;
	url: string;
	verified: boolean;
	want_retweets: boolean;
	withheld_in_countries: [];
}

export interface UserEntities {
	description: {
		urls: Url[];
	};
	url: {
		urls: Url[];
	};
}

export interface Professional {
	rest_id: string;
	professional_type: string;
	category: Category[];
}

export interface Category {
	id: number;
	name: string;
	icon_name: string;
}

export interface NoteTweet {
	id: string;
	text: string;
	entity_set: NoteTweetEntities;
	richtext: {
		richtext_tags: [];
	};
	media: {
		inline_media: [];
	};
}

export interface NoteTweetEntities {
	hashtags: [];
	symbols: [];
	urls: Url[];
	user_mentions: UserMention[];
}

export interface TweetTombstone {
	__typename: 'TweetTombstone';
	tombstone: {
		__typename: 'TextTombstone';
		text: {
			rtl: boolean;
			text: string;
			entities: TombstoneEntity[];
		};
	};
}

export interface TombstoneEntity {
	fromIndex: number;
	toIndex: number;
	ref: {
		type: string;
		url: string;
		urlType: string;
	};
}

export type TwitterBookmarksArray = TwitterBookmarkResponse[];
