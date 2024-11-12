import type { Tweet, TweetWithVisibilityResults, TweetTombstone } from './types';

export function getFirstImageUrl(tweet: Tweet): string | null {
	const media = tweet.legacy.extended_entities?.media || tweet.legacy.entities.media;
	if (!media?.length) return null;
	return media[0].media_url_https;
}
export function getFirstSentence(text: string): string {
	if (text.includes('\n')) {
		return text.split('\n')[0];
	}
	const match = text.match(/^[^.!?]+[.!?]/);
	return match ? match[0] : text;
}
// Add type guard
export function isTweetWithVisibilityResults(tweet: Tweet | TweetWithVisibilityResults): tweet is TweetWithVisibilityResults {
	return tweet.__typename === 'TweetWithVisibilityResults';
}
function isTweetTombstone(tweet: Tweet | TweetTombstone): tweet is TweetTombstone {
	return tweet.__typename === 'TweetTombstone';
}
export function formatTweetContent(tweet: Tweet): string {
	let content = tweet.legacy.full_text;

	if (tweet.quoted_status_result?.result) {
		const quotedResult = tweet.quoted_status_result.result;

		// Handle tombstones first
		if (isTweetTombstone(quotedResult)) {
			content = `${content}\n\n> [${quotedResult.tombstone.text.text}]`;
		} else {
			// Handle normal quoted tweets
			if (quotedResult.__typename === "Tweet") {
				const tweetResult = quotedResult as Tweet;
				if (tweetResult.legacy?.full_text) {
					const quotedAuthor = tweetResult.core?.user_results?.result?.legacy?.name || 'Unknown Author';
					const quotedText = tweetResult.legacy.full_text;
					content = `> "${quotedText}" — ${quotedAuthor}\n\n${content}`;
				}
			} else {
				const tweetResult = quotedResult as Tweet;
				console.log('Quoted tweet has incomplete data:', {
					tweetId: tweet.rest_id,
					quotedTweetId: tweetResult.rest_id,
					quotedTweetType: tweetResult.__typename,
					hasLegacy: 'legacy' in tweetResult && !!tweetResult.legacy,
					hasFullText: 'legacy' in tweetResult && !!tweetResult.legacy?.full_text,
					quotedTweet: tweetResult
				});
			}
		}
	}

	return content;
}
