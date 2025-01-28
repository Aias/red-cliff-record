import { db } from '~/server/db/connections';
import { type twitterTweets, type twitterUsers } from '~/server/db/schema/integrations/twitter';
import { syncEmbeddings, type EmbeddableDocument } from '../common/embeddings';
import { runIntegration } from '../common/run-integration';

// Tweet implementation
class TwitterTweet implements EmbeddableDocument {
	constructor(
		private tweet: typeof twitterTweets.$inferSelect & {
			user?: {
				username: string | null;
				displayName: string | null;
			} | null;
		}
	) {}

	get id() {
		return this.tweet.id;
	}

	get tableName() {
		return 'integrations.twitter_tweets';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	getEmbeddingText(): string {
		const textParts = [
			'# Tweet Information',
			`Text: ${this.tweet.text || '—'}`,
			`Quoted Tweet ID: ${this.tweet.quotedTweetId || '—'}`,
		];

		if (this.tweet.user) {
			textParts.push(
				'',
				'# Author Information',
				`Username: ${this.tweet.user.username || '—'}`,
				`Display Name: ${this.tweet.user.displayName || '—'}`
			);
		}

		return textParts.join('\n');
	}
}

// User implementation
class TwitterUser implements EmbeddableDocument {
	constructor(
		private user: typeof twitterUsers.$inferSelect & {
			tweets?: {
				text: string | null;
			}[];
		}
	) {}

	get id() {
		return this.user.id;
	}

	get tableName() {
		return 'integrations.twitter_users';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	getEmbeddingText(): string {
		const textParts = [
			'# User Information',
			`Username: ${this.user.username || '—'}`,
			`Display Name: ${this.user.displayName || '—'}`,
			`Description: ${this.user.description || '—'}`,
			`Location: ${this.user.location || '—'}`,
			`URL: ${this.user.url || '—'}`,
			`External URL: ${this.user.externalUrl || '—'}`,
		];

		if (this.user.tweets?.length) {
			textParts.push(
				'',
				'# Recent Tweets',
				...this.user.tweets.map((tweet, index) => `Tweet ${index + 1}: ${tweet.text || '—'}`)
			);
		}

		return textParts.join('\n');
	}
}

// Fetch functions
async function getTweetsWithoutEmbeddings() {
	const tweets = await db.query.twitterTweets.findMany({
		with: {
			user: {
				columns: {
					username: true,
					displayName: true,
				},
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return tweets.map((tweet) => new TwitterTweet(tweet));
}

async function getUsersWithoutEmbeddings() {
	const users = await db.query.twitterUsers.findMany({
		with: {
			tweets: {
				columns: {
					text: true,
				},
				limit: 5, // Get 5 most recent tweets
				orderBy: (fields, { desc }) => [desc(fields.contentCreatedAt)],
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return users.map((user) => new TwitterUser(user));
}

// Sync function
async function syncTwitterEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync tweets
	totalCount += await syncEmbeddings(getTweetsWithoutEmbeddings, 'twitter-tweets');

	// Sync users
	totalCount += await syncEmbeddings(getUsersWithoutEmbeddings, 'twitter-users');

	return totalCount;
}

const main = async () => {
	try {
		await runIntegration('embeddings', syncTwitterEmbeddings);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embeddings.ts')) {
	main();
}

export { syncTwitterEmbeddings };
