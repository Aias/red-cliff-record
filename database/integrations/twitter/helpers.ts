import type {
	Tweet,
	TweetWithVisibilityResults,
	TweetTombstone,
	QuotedTweetWithVisibilityResults
} from './types';

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
export function isTweetWithVisibilityResults(
	tweet: Tweet | TweetWithVisibilityResults
): tweet is TweetWithVisibilityResults {
	return tweet.__typename === 'TweetWithVisibilityResults';
}

function isTweetTombstone(tweet: any): tweet is TweetTombstone {
	return tweet.__typename === 'TweetTombstone';
}

function isQuotedTweetWithVisibility(
	result: any
): result is { quotedTweet: QuotedTweetWithVisibilityResults } {
	return (
		result &&
		'quotedTweet' in result &&
		result.quotedTweet.__typename === 'TweetWithVisibilityResults'
	);
}

export function formatTweetContent(tweet: Tweet): string {
	let content = tweet.legacy.full_text;

	if (tweet.quoted_status_result?.result) {
		const quotedResult = tweet.quoted_status_result.result;

		// Handle tombstones first
		if (isTweetTombstone(quotedResult)) {
			content = `${content}\n\n> [${quotedResult.tombstone.text.text}]`;
		} else if (isQuotedTweetWithVisibility(quotedResult)) {
			// Handle the new quoted tweet structure with visibility results
			const quotedTweet = quotedResult.quotedTweet.tweet;
			if (quotedTweet.legacy?.full_text) {
				const quotedAuthor =
					quotedTweet.core?.user_results?.result?.legacy?.name || 'Unknown Author';
				const quotedText = quotedTweet.legacy.full_text;
				content = `${content}\n\n> "${quotedText}" — ${quotedAuthor}`;
			}
		} else if ('legacy' in quotedResult && quotedResult.legacy?.full_text) {
			// Handle normal quoted tweets
			const quotedAuthor =
				quotedResult.core?.user_results?.result?.legacy?.name || 'Unknown Author';
			const quotedText = quotedResult.legacy.full_text;
			content = `${content}\n\n> "${quotedText}" — ${quotedAuthor}`;
		} else {
			console.log('Quoted tweet has incomplete data:', {
				tweetId: tweet.rest_id,
				quotedTweetId: quotedResult.rest_id,
				quotedTweetType: quotedResult.__typename,
				hasLegacy: 'legacy' in quotedResult && !!quotedResult.legacy,
				hasFullText: 'legacy' in quotedResult && !!quotedResult.legacy?.full_text,
				quotedTweet: quotedResult
			});
		}
	}

	return content;
}
