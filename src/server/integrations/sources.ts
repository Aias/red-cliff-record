import { eq } from 'drizzle-orm';
import { db } from '../db/connections';
import { records, type IntegrationType } from '../db/schema';

export const updateRecordsSources = async (): Promise<void> => {
	console.log('Updating records sources');

	const batchSize = 200;
	let offset = 0;

	while (true) {
		const recordList = await db.query.records.findMany({
			limit: batchSize,
			offset,
			with: {
				airtableCreators: {
					columns: {
						id: true,
					},
				},
				airtableExtracts: {
					columns: {
						id: true,
					},
				},
				airtableFormats: {
					columns: {
						id: true,
					},
				},
				airtableSpaces: {
					columns: {
						id: true,
					},
				},
				githubRepositories: {
					columns: {
						id: true,
					},
				},
				githubUsers: {
					columns: {
						id: true,
					},
				},
				lightroomImages: {
					columns: {
						id: true,
					},
				},
				raindropBookmarks: {
					columns: {
						id: true,
					},
				},
				raindropCollections: {
					columns: {
						id: true,
					},
				},
				raindropTags: {
					columns: {
						id: true,
					},
				},
				readwiseAuthors: {
					columns: {
						id: true,
					},
				},
				readwiseDocuments: {
					columns: {
						id: true,
					},
				},
				readwiseTags: {
					columns: {
						id: true,
					},
				},
				twitterTweets: {
					columns: {
						id: true,
					},
				},
				twitterUsers: {
					columns: {
						id: true,
					},
				},
			},
		});

		if (recordList.length === 0) {
			// When there are no more records, exit the loop.
			break;
		}

		console.log(`Processing batch starting at offset ${offset} with ${recordList.length} records`);

		for (const r of recordList) {
			const sources: IntegrationType[] = [];

			if (
				r.airtableExtracts.length > 0 ||
				r.airtableCreators.length > 0 ||
				r.airtableFormats.length > 0 ||
				r.airtableSpaces.length > 0
			) {
				sources.push('airtable');
			}

			if (r.githubRepositories.length > 0 || r.githubUsers.length > 0) {
				sources.push('github');
			}

			if (
				r.raindropBookmarks.length > 0 ||
				r.raindropCollections.length > 0 ||
				r.raindropTags.length > 0
			) {
				sources.push('raindrop');
			}

			if (
				r.readwiseDocuments.length > 0 ||
				r.readwiseTags.length > 0 ||
				r.readwiseAuthors.length > 0
			) {
				sources.push('readwise');
			}

			if (r.twitterTweets.length > 0 || r.twitterUsers.length > 0) {
				sources.push('twitter');
			}

			if (r.lightroomImages.length > 0) {
				sources.push('lightroom');
			}

			console.log(`Setting sources for ${r.id} - ${sources.join(', ')}`);

			await db
				.update(records)
				.set({
					sources,
				})
				.where(eq(records.id, r.id));
		}

		offset += batchSize;
	}
};

updateRecordsSources();
