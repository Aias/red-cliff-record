import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import type {
	GithubCommitChangeSelect,
	GithubCommitSelect,
	GithubRepositorySelect,
} from '@/server/db/schema/github';
import { githubCommits } from '@/server/db/schema/github';
import { summarizeCommit } from '../../services/ai/summarize-commit';

type CommitWithRelations = GithubCommitSelect & {
	repository: GithubRepositorySelect;
	commitChanges: GithubCommitChangeSelect[];
};

const BATCH_SIZE = 20;

async function getCommitsWithoutSummaries() {
	const commits = await db.query.githubCommits.findMany({
		with: {
			repository: {
				columns: {
					fullName: true,
					description: true,
					language: true,
					topics: true,
					licenseName: true,
				},
			},
			commitChanges: {
				columns: {
					filename: true,
					status: true,
					changes: true,
					deletions: true,
					additions: true,
					patch: true,
				},
			},
		},
		where: {
			summary: {
				isNull: true,
			},
		},
		orderBy: {
			committedAt: 'asc',
		},
	});

	return commits as unknown as CommitWithRelations[];
}

async function processBatch(
	commits: CommitWithRelations[],
	batchNumber: number,
	totalCommits: number
) {
	const results = await Promise.allSettled(
		commits.map(async (commit, index) => {
			try {
				const remainingBatches = Math.ceil((totalCommits - batchNumber * BATCH_SIZE) / BATCH_SIZE);
				console.log(
					`\nBatch ${batchNumber + 1} (${remainingBatches} batches remaining) - Commit ${index + 1}/${commits.length}`,
					`\nStarting summarization for commit ${commit.sha.slice(0, 7)}:`,
					`\n  Repository: ${commit.repository.fullName}`,
					`\n  Message: ${commit.message.split('\n')[0]}`
				);

				const summary = await summarizeCommit({
					message: commit.message,
					sha: commit.sha,
					changes: commit.changes,
					additions: commit.additions,
					deletions: commit.deletions,
					commitChanges: commit.commitChanges.map((change) => ({
						filename: change.filename,
						status: change.status,
						changes: change.changes,
						deletions: change.deletions,
						additions: change.additions,
						patch: change.patch,
					})),
					repository: {
						fullName: commit.repository.fullName,
						description: commit.repository.description,
						language: commit.repository.language,
						topics: commit.repository.topics,
						licenseName: commit.repository.licenseName,
					},
				});

				console.log(
					`Completed summarization for commit ${commit.sha.slice(0, 7)}:`,
					`\n  Type: ${summary.primary_purpose}`,
					`\n  Summary: ${summary.summary.slice(0, 100)}${summary.summary.length > 100 ? '...' : ''}`
				);

				await db
					.update(githubCommits)
					.set({
						summary: summary.summary,
						commitType: summary.primary_purpose,
						technologies: summary.technologies,
					})
					.where(eq(githubCommits.sha, commit.sha));

				return { success: true, sha: commit.sha };
			} catch (error) {
				console.error(`Failed to summarize commit ${commit.sha}:`, error);
				return { success: false, sha: commit.sha, error };
			}
		})
	);

	return results;
}

export async function syncCommitSummaries(): Promise<number> {
	let totalProcessed = 0;
	let commits;
	let batchNumber = 0;

	commits = await getCommitsWithoutSummaries();
	const totalCommits = commits.length;
	console.log(
		`\nStarting summarization of ${totalCommits} commits in ${Math.ceil(totalCommits / BATCH_SIZE)} batches\n`
	);

	do {
		const batch = commits.slice(0, BATCH_SIZE);

		if (batch.length === 0) break;

		const results = await processBatch(batch, batchNumber, totalCommits);
		const successful = results.filter(
			(result) => result.status === 'fulfilled' && result.value.success
		).length;

		totalProcessed += successful;

		console.log(
			`\nCompleted batch ${batchNumber + 1} of ${Math.ceil(totalCommits / BATCH_SIZE)}:`,
			`\n  Processed ${batch.length} commits, ${successful} successful`,
			`\n  Total processed so far: ${totalProcessed}/${totalCommits}`
		);

		batchNumber++;
		commits = await getCommitsWithoutSummaries();
	} while (commits.length >= BATCH_SIZE);

	console.log(
		`\nFinished processing all commits. Total successful: ${totalProcessed}/${totalCommits}`
	);
	return totalProcessed;
}
