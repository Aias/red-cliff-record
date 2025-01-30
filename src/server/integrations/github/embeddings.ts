import { eq, isNull } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	githubCommits,
	githubRepositories,
	githubUsers,
	type GithubCommitSelect,
	type GithubRepositorySelect,
	type GithubUserSelect,
} from '~/server/db/schema/integrations/github';
import { createEmbedding, type EmbeddingType } from '~/server/services/ai/create-embedding';
import { runIntegration } from '../common/run-integration';

// Repository implementation
class GithubRepository implements EmbeddingType {
	constructor(
		private repo: GithubRepositorySelect & {
			owner?: {
				login: string | null;
				name: string | null;
				type: string | null;
			} | null;
		}
	) {}

	getEmbeddingText(): string {
		const textParts = [
			'# Repository Information',
			`Name: ${this.repo.name || '—'}`,
			`Full Name: ${this.repo.fullName || '—'}`,
			`Description: ${this.repo.description || '—'}`,
			`Homepage: ${this.repo.homepageUrl || '—'}`,
			`Language: ${this.repo.language || '—'}`,
			`Topics: ${this.repo.topics?.join(', ') || '—'}`,
			`License: ${this.repo.licenseName || '—'}`,
			`Private: ${this.repo.private ? 'Yes' : 'No'}`,
			`Readme: ${this.repo.readme || '—'}`,
		];

		if (this.repo.owner) {
			textParts.push(
				'',
				'# Owner Information',
				`Login: ${this.repo.owner.login || '—'}`,
				`Name: ${this.repo.owner.name || '—'}`,
				`Type: ${this.repo.owner.type || '—'}`
			);
		}

		return textParts.join('\n');
	}
}

// User implementation
class GithubUser implements EmbeddingType {
	constructor(
		private user: GithubUserSelect & {
			repositories?: {
				name: string | null;
				fullName: string | null;
				description: string | null;
			}[];
		}
	) {}

	getEmbeddingText(): string {
		const textParts = [
			'# User Information',
			`Login: ${this.user.login || '—'}`,
			`Name: ${this.user.name || '—'}`,
			`Company: ${this.user.company || '—'}`,
			`Blog: ${this.user.blog || '—'}`,
			`Location: ${this.user.location || '—'}`,
			`Email: ${this.user.email || '—'}`,
			`Bio: ${this.user.bio || '—'}`,
			`Twitter Username: ${this.user.twitterUsername || '—'}`,
			`Type: ${this.user.type || '—'}`,
			`Followers: ${this.user.followers || '—'}`,
			`Following: ${this.user.following || '—'}`,
		];

		if (this.user.repositories?.length) {
			textParts.push(
				'',
				'# Repositories',
				...this.user.repositories.map(
					(repo) => `${repo.name || '—'} (${repo.fullName || '—'}): ${repo.description || '—'}`
				)
			);
		}

		return textParts.join('\n');
	}
}

class GithubCommit implements EmbeddingType {
	constructor(
		private commit: GithubCommitSelect & {
			repository?: {
				fullName: string | null;
			} | null;
			commitChanges?: {
				filename: string | null;
				status: string | null;
				changes: number | null;
			}[];
		}
	) {}

	getEmbeddingText(): string {
		const textParts = [
			'# Commit Information',
			`Message: ${this.commit.message || '—'}`,
			`Type: ${this.commit.commitType || '—'}`,
			`Summary: ${this.commit.summary || '—'}`,
			`Technologies: ${this.commit.technologies?.join(', ') || '—'}`,
			`Changes: ${this.commit.changes || '—'}`,
			`Additions: ${this.commit.additions || '—'}`,
			`Deletions: ${this.commit.deletions || '—'}`,
		];

		if (this.commit.repository) {
			textParts.push(
				'',
				'# Repository Information',
				`Repository: ${this.commit.repository.fullName || '—'}`
			);
		}

		if (this.commit.commitChanges?.length) {
			textParts.push(
				'',
				'# Changed Files',
				...this.commit.commitChanges.map(
					(change) =>
						`${change.filename || '—'} (${change.status || '—'}, ${change.changes || '—'} changes)`
				)
			);
		}

		return textParts.join('\n');
	}
}

// Fetch and update functions
async function updateRepositoryEmbeddings() {
	const repos = await db.query.githubRepositories.findMany({
		with: {
			owner: {
				columns: {
					login: true,
					name: true,
					type: true,
				},
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const repo of repos) {
		const embeddingText = new GithubRepository(repo).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db
			.update(githubRepositories)
			.set({ embedding })
			.where(eq(githubRepositories.id, repo.id));
		count++;
	}
	return count;
}

async function updateUserEmbeddings() {
	const users = await db.query.githubUsers.findMany({
		with: {
			repositories: {
				columns: {
					name: true,
					fullName: true,
					description: true,
				},
				limit: 10, // Get 10 most recent repositories
				orderBy: (fields, { desc }) => [desc(fields.contentCreatedAt)],
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const user of users) {
		const embeddingText = new GithubUser(user).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(githubUsers).set({ embedding }).where(eq(githubUsers.id, user.id));
		count++;
	}
	return count;
}

async function updateCommitEmbeddings() {
	const commits = await db.query.githubCommits.findMany({
		with: {
			repository: {
				columns: {
					fullName: true,
				},
			},
			commitChanges: {
				columns: {
					filename: true,
					status: true,
					changes: true,
				},
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const commit of commits) {
		const embeddingText = new GithubCommit(commit).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(githubCommits).set({ embedding }).where(eq(githubCommits.id, commit.id));
		count++;
	}
	return count;
}

// Sync function
async function syncGithubEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync repositories
	totalCount += await updateRepositoryEmbeddings();

	// Sync users
	totalCount += await updateUserEmbeddings();

	// Sync commits
	totalCount += await updateCommitEmbeddings();

	return totalCount;
}

const main = async () => {
	try {
		await runIntegration('embeddings', syncGithubEmbeddings);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embeddings.ts')) {
	main();
}

export { syncGithubEmbeddings };
