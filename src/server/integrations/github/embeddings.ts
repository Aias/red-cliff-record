import { eq, isNull } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { githubCommits, type GithubCommitSelect } from '@/server/db/schema/github';
import { createEmbedding, type EmbeddingType } from '@/server/services/ai/create-embedding';

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

async function updateCommitEmbeddings() {
	console.log('Updating commit embeddings');
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
		where: (fields) => isNull(fields.textEmbedding),
	});

	console.log(`Found ${commits.length} commits to update`);

	let count = 0;
	for (const commit of commits) {
		const embeddingText = new GithubCommit(commit).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db
			.update(githubCommits)
			.set({ textEmbedding: embedding })
			.where(eq(githubCommits.id, commit.id));
		count++;
	}
	console.log(`Updated ${count} commit embeddings`);
	return count;
}

// Sync function
export async function syncGithubEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync commits
	totalCount += await updateCommitEmbeddings();

	return totalCount;
}
