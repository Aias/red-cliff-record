import { eq, isNull } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	twitterTweets,
	twitterUsers,
	type TwitterTweetSelect,
	type TwitterUserSelect,
} from '~/server/db/schema/integrations/twitter';
import { createEmbedding, type EmbeddingType } from '~/server/services/ai/create-embedding';
import { runIntegration } from '../common/run-integration';

// Tweet implementation
class TwitterTweet implements EmbeddingType {
	constructor(
		private tweet: TwitterTweetSelect & {
			user?: {
				username: string | null;
				displayName: string | null;
			} | null;
		}
	) {}

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
class TwitterUser implements EmbeddingType {
	constructor(
		private user: TwitterUserSelect & {
			tweets?: {
				text: string | null;
			}[];
		}
	) {}

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

// Fetch and update functions
async function updateTweetEmbeddings() {
	const tweets = await db.query.twitterTweets.findMany({
		with: {
			user: {
				columns: {
					username: true,
					displayName: true,
				},
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const tweet of tweets) {
		const embeddingText = new TwitterTweet(tweet).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(twitterTweets).set({ embedding }).where(eq(twitterTweets.id, tweet.id));
		count++;
	}
	return count;
}

async function updateUserEmbeddings() {
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
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const user of users) {
		const embeddingText = new TwitterUser(user).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(twitterUsers).set({ embedding }).where(eq(twitterUsers.id, user.id));
		count++;
	}
	return count;
}

// Sync function
async function syncTwitterEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync tweets
	totalCount += await updateTweetEmbeddings();

	// Sync users
	totalCount += await updateUserEmbeddings();

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
