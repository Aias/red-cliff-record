import { db } from '~/server/db/connections';
import {
	type githubCommits,
	type githubRepositories,
	type githubUsers,
} from '~/server/db/schema/integrations/github';
import { syncEmbeddings, type EmbeddableDocument } from '../common/embeddings';
import { runIntegration } from '../common/run-integration';

// Repository implementation
class GithubRepository implements EmbeddableDocument {
	constructor(
		private repo: typeof githubRepositories.$inferSelect & {
			owner?: {
				login: string | null;
				name: string | null;
				type: string | null;
			} | null;
		}
	) {}

	get id() {
		return this.repo.id;
	}

	get tableName() {
		return 'integrations.github_repositories';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

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
class GithubUser implements EmbeddableDocument {
	constructor(
		private user: typeof githubUsers.$inferSelect & {
			repositories?: {
				name: string | null;
				fullName: string | null;
				description: string | null;
			}[];
		}
	) {}

	get id() {
		return this.user.id;
	}

	get tableName() {
		return 'integrations.github_users';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

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

class GithubCommit implements EmbeddableDocument {
	constructor(
		private commit: typeof githubCommits.$inferSelect & {
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

	get id() {
		return this.commit.id;
	}

	get tableName() {
		return 'integrations.github_commits';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

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

// Fetch functions
async function getRepositoriesWithoutEmbeddings() {
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
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return repos.map((repo) => new GithubRepository(repo));
}

async function getUsersWithoutEmbeddings() {
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
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return users.map((user) => new GithubUser(user));
}

async function getCommitsWithoutEmbeddings() {
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
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return commits.map((commit) => new GithubCommit(commit));
}

// Sync function
async function syncGithubEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync repositories
	totalCount += await syncEmbeddings(getRepositoriesWithoutEmbeddings, 'github-repositories');

	// Sync users
	totalCount += await syncEmbeddings(getUsersWithoutEmbeddings, 'github-users');

	// Sync commits
	totalCount += await syncEmbeddings(getCommitsWithoutEmbeddings, 'github-commits');

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
