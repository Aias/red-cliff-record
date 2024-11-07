import { Octokit } from '@octokit/rest';
import { db } from '../src/db';
import {
	bookmarks,
	integrationRuns,
	IntegrationStatus,
	IntegrationType,
	RunType
} from '../src/schema';
import { inArray, eq } from 'drizzle-orm';

const REQUEST_ACCEPT_HEADER = 'application/vnd.github.star+json';

async function seedGithubStars() {
	const run = await db
		.insert(integrationRuns)
		.values({
			integrationType: IntegrationType.GITHUB,
			runType: RunType.FULL,
			runStartTime: new Date()
		})
		.returning();

	if (run.length === 0) {
		console.error('Could not create integration run.');
		return;
	}
	console.log(`Created integration run with id ${run[0].id}`);

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	try {
		console.log('Deleting existing starred repositories.');
		await db
			.delete(bookmarks)
			.where(
				inArray(
					bookmarks.integrationRunId,
					db
						.select({ id: integrationRuns.id })
						.from(integrationRuns)
						.where(eq(integrationRuns.integrationType, IntegrationType.GITHUB))
				)
			);
		console.log('Starred repositories deleted.');

		const stars = [];
		let page = 1;

		while (true) {
			const response = await octokit.request('GET /user/starred', {
				per_page: 100,
				page: page,
				headers: {
					accept: REQUEST_ACCEPT_HEADER
				}
			});

			if (response.data.length === 0) break;

			stars.push(...response.data);
			page++;
		}

		const bookmarksFromStars = stars.map(({ starred_at, repo }: Record<string, any>) => ({
			url: repo.html_url as string,
			title: repo.full_name as string,
			content: repo.description?.trim() || null,
			createdAt: new Date(starred_at),
			type: 'repository',
			category: 'Code',
			tags: repo.topics as string[],
			imageUrl: repo?.owner?.avatar_url as string,
			integrationRunId: run[0].id
		}));

		console.log(`Inserting ${bookmarksFromStars.length} rows into bookmarks`);
		const chunkSize = 100;
		for (let i = 0; i < bookmarksFromStars.length; i += chunkSize) {
			const chunk = bookmarksFromStars.slice(i, i + chunkSize);
			await db.insert(bookmarks).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(bookmarksFromStars.length / chunkSize)}`
			);
		}
		console.log('Bookmark rows inserted.');

		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.SUCCESS,
				runEndTime: new Date(),
				entriesCreated: bookmarksFromStars.length
			})
			.where(eq(integrationRuns.id, run[0].id));
		console.log(`Updated integration run with id ${run[0].id}`);
	} catch (err) {
		console.error('Error fetching stars:', err);
		await db
			.update(integrationRuns)
			.set({ status: IntegrationStatus.FAIL, runEndTime: new Date() })
			.where(eq(integrationRuns.id, run[0].id));
		console.error(`Updated integration run with id ${run[0].id} to failed`);
	}
}

seedGithubStars();
