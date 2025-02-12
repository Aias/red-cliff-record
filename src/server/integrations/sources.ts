import { eq } from 'drizzle-orm';
import { db } from '../db/connections';
import { indices, media, records, type IntegrationType } from '../db/schema';

export const updateMediaSources = async () => {
	console.log('Updating media sources');
	const mediaRecords = await db.query.media.findMany({
		with: {
			airtableAttachments: true,
			lightroomImages: true,
			raindropBookmarks: true,
			readwiseDocuments: true,
			twitterMedia: true,
		},
	});

	for (const m of mediaRecords) {
		const sources: IntegrationType[] = [];

		if (m.airtableAttachments.length > 0) {
			sources.push('airtable');
		}

		if (m.lightroomImages.length > 0) {
			sources.push('lightroom');
		}

		if (m.raindropBookmarks.length > 0) {
			sources.push('raindrop');
		}

		if (m.readwiseDocuments.length > 0) {
			sources.push('readwise');
		}

		if (m.twitterMedia.length > 0) {
			sources.push('twitter');
		}

		console.log(`Setting sources for ${m.id} - ${sources.join(', ')}`);

		await db
			.update(media)
			.set({
				sources,
			})
			.where(eq(media.id, m.id));
	}
};

export const updateRecordsSources = async () => {
	console.log('Updating records sources');
	const recordList = await db.query.records.findMany({
		with: {
			airtableExtracts: true,
			githubRepositories: true,
			raindropBookmarks: true,
			readwiseDocuments: true,
			twitterTweets: true,
			lightroomImages: true,
		},
	});

	for (const r of recordList) {
		const sources: IntegrationType[] = [];

		if (r.airtableExtracts.length > 0) {
			sources.push('airtable');
		}

		if (r.githubRepositories.length > 0) {
			sources.push('github');
		}

		if (r.raindropBookmarks.length > 0) {
			sources.push('raindrop');
		}

		if (r.readwiseDocuments.length > 0) {
			sources.push('readwise');
		}

		if (r.twitterTweets.length > 0) {
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
};

export const updateIndicesSources = async () => {
	console.log('Updating indices sources');
	const indexList = await db.query.indices.findMany({
		with: {
			airtableCreators: true,
			airtableFormats: true,
			airtableSpaces: true,
			githubUsers: true,
			raindropCollections: true,
			raindropTags: true,
			readwiseAuthors: true,
			readwiseTags: true,
			twitterUsers: true,
		},
	});

	for (const i of indexList) {
		const sources: IntegrationType[] = [];

		if (
			i.airtableCreators.length > 0 ||
			i.airtableFormats.length > 0 ||
			i.airtableSpaces.length > 0
		) {
			sources.push('airtable');
		}

		if (i.githubUsers.length > 0) {
			sources.push('github');
		}

		if (i.raindropCollections.length > 0 || i.raindropTags.length > 0) {
			sources.push('raindrop');
		}

		if (i.readwiseAuthors.length > 0 || i.readwiseTags.length > 0) {
			sources.push('readwise');
		}

		if (i.twitterUsers.length > 0) {
			sources.push('twitter');
		}

		console.log(`Setting sources for ${i.id} - ${sources.join(', ')}`);

		await db
			.update(indices)
			.set({
				sources,
			})
			.where(eq(indices.id, i.id));
	}
};

// updateMediaSources();
updateRecordsSources();
updateIndicesSources();
