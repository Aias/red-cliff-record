import { defineRelations } from 'drizzle-orm';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtractConnections,
	airtableExtractCreators,
	airtableExtracts,
	airtableExtractSpaces,
	airtableFormats,
	airtableSpaces,
	browsingHistory,
	githubCommitChanges,
	githubCommits,
	githubRepositories,
	githubUsers,
	integrationRuns,
	lightroomImages,
	media,
	raindropBookmarks,
	raindropBookmarkTags,
	raindropCollections,
	raindropImages,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseDocumentTags,
	readwiseTags,
	recordCreators,
	recordRelations,
	records,
	twitterMedia,
	twitterTweets,
	twitterUsers,
} from '@/db/schema';

export const relations = defineRelations(
	{
		airtableAttachments,
		airtableCreators,
		airtableExtractConnections,
		airtableExtractCreators,
		airtableExtracts,
		airtableExtractSpaces,
		airtableFormats,
		airtableSpaces,
		browsingHistory,
		githubCommitChanges,
		githubCommits,
		githubRepositories,
		githubUsers,
		integrationRuns,
		lightroomImages,
		media,
		raindropBookmarks,
		raindropBookmarkTags,
		raindropCollections,
		raindropImages,
		raindropTags,
		readwiseAuthors,
		readwiseDocuments,
		readwiseDocumentTags,
		readwiseTags,
		recordCreators,
		recordRelations,
		records,
		twitterMedia,
		twitterTweets,
		twitterUsers,
	},
	(r) => ({
		airtableAttachments: {
			extract: r.one.airtableExtracts({
				from: r.airtableAttachments.extractId,
				to: r.airtableExtracts.id,
				optional: false,
			}),
			media: r.one.media({
				from: r.airtableAttachments.mediaId,
				to: r.media.id,
			}),
		},
		airtableCreators: {
			integrationRun: r.one.integrationRuns({
				from: r.airtableCreators.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.airtableCreators.recordId,
				to: r.records.id,
			}),
			extracts: r.many.airtableExtracts({
				from: r.airtableCreators.id.through(r.airtableExtractCreators.creatorId),
				to: r.airtableExtracts.id.through(r.airtableExtractCreators.extractId),
			}),
		},
		airtableExtracts: {
			children: r.many.airtableExtracts({
				from: r.airtableExtracts.id,
				to: r.airtableExtracts.parentId,
			}),
			parent: r.one.airtableExtracts({
				from: r.airtableExtracts.parentId,
				to: r.airtableExtracts.id,
			}),
			creators: r.many.airtableCreators({
				from: r.airtableExtracts.id.through(r.airtableExtractCreators.extractId),
				to: r.airtableCreators.id.through(r.airtableExtractCreators.creatorId),
			}),
			spaces: r.many.airtableSpaces({
				from: r.airtableExtracts.id.through(r.airtableExtractSpaces.extractId),
				to: r.airtableSpaces.id.through(r.airtableExtractSpaces.spaceId),
			}),
			outgoingConnections: r.many.airtableExtracts({
				from: r.airtableExtracts.id.through(r.airtableExtractConnections.fromExtractId),
				to: r.airtableExtracts.id.through(r.airtableExtractConnections.toExtractId),
			}),
			incomingConnections: r.many.airtableExtracts({
				from: r.airtableExtracts.id.through(r.airtableExtractConnections.toExtractId),
				to: r.airtableExtracts.id.through(r.airtableExtractConnections.fromExtractId),
			}),
			attachments: r.many.airtableAttachments({
				from: r.airtableExtracts.id,
				to: r.airtableAttachments.extractId,
			}),
			integrationRun: r.one.integrationRuns({
				from: r.airtableExtracts.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.airtableExtracts.recordId,
				to: r.records.id,
			}),
			format: r.one.airtableFormats({
				from: r.airtableExtracts.formatId,
				to: r.airtableFormats.id,
			}),
		},
		airtableFormats: {
			integrationRun: r.one.integrationRuns({
				from: r.airtableFormats.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.airtableFormats.recordId,
				to: r.records.id,
			}),
			extracts: r.many.airtableExtracts(),
		},
		airtableExtractConnections: {
			fromExtract: r.one.airtableExtracts({
				from: r.airtableExtractConnections.fromExtractId,
				to: r.airtableExtracts.id,
				optional: false,
			}),
			toExtract: r.one.airtableExtracts({
				from: r.airtableExtractConnections.toExtractId,
				to: r.airtableExtracts.id,
				optional: false,
			}),
		},
		airtableExtractCreators: {
			extract: r.one.airtableExtracts({
				from: r.airtableExtractCreators.extractId,
				to: r.airtableExtracts.id,
			}),
			creator: r.one.airtableCreators({
				from: r.airtableExtractCreators.creatorId,
				to: r.airtableCreators.id,
			}),
		},
		airtableExtractSpaces: {
			extract: r.one.airtableExtracts({
				from: r.airtableExtractSpaces.extractId,
				to: r.airtableExtracts.id,
			}),
			space: r.one.airtableSpaces({
				from: r.airtableExtractSpaces.spaceId,
				to: r.airtableSpaces.id,
			}),
		},
		airtableSpaces: {
			integrationRun: r.one.integrationRuns({
				from: r.airtableSpaces.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.airtableSpaces.recordId,
				to: r.records.id,
			}),
			extracts: r.many.airtableExtracts({
				from: r.airtableSpaces.id.through(r.airtableExtractSpaces.spaceId),
				to: r.airtableExtracts.id.through(r.airtableExtractSpaces.extractId),
			}),
		},
		browsingHistory: {
			integrationRun: r.one.integrationRuns({
				from: r.browsingHistory.integrationRunId,
				to: r.integrationRuns.id,
			}),
		},
		githubCommits: {
			repository: r.one.githubRepositories({
				from: r.githubCommits.repositoryId,
				to: r.githubRepositories.id,
			}),
			integrationRun: r.one.integrationRuns({
				from: r.githubCommits.integrationRunId,
				to: r.integrationRuns.id,
			}),
			commitChanges: r.many.githubCommitChanges({
				from: r.githubCommits.id,
				to: r.githubCommitChanges.commitId,
			}),
		},
		githubCommitChanges: {
			commit: r.one.githubCommits({
				from: r.githubCommitChanges.commitId,
				to: r.githubCommits.id,
			}),
		},
		githubUsers: {
			integrationRun: r.one.integrationRuns({
				from: r.githubUsers.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.githubUsers.recordId,
				to: r.records.id,
			}),
			repositories: r.many.githubRepositories({
				from: r.githubUsers.id,
				to: r.githubRepositories.ownerId,
			}),
		},
		githubRepositories: {
			owner: r.one.githubUsers({
				from: r.githubRepositories.ownerId,
				to: r.githubUsers.id,
				optional: false,
			}),
			integrationRun: r.one.integrationRuns({
				from: r.githubRepositories.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.githubRepositories.recordId,
				to: r.records.id,
			}),
			commits: r.many.githubCommits({
				from: r.githubRepositories.id,
				to: r.githubCommits.repositoryId,
			}),
		},
		lightroomImages: {
			integrationRun: r.one.integrationRuns({
				from: r.lightroomImages.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.lightroomImages.recordId,
				to: r.records.id,
			}),
			media: r.one.media({
				from: r.lightroomImages.mediaId,
				to: r.media.id,
			}),
		},
		integrationRuns: {
			airtableExtracts: r.many.airtableExtracts(),
			airtableCreators: r.many.airtableCreators(),
			airtableSpaces: r.many.airtableSpaces(),
			airtableFormats: r.many.airtableFormats(),
			browsingHistory: r.many.browsingHistory(),
			githubCommits: r.many.githubCommits(),
			githubRepositories: r.many.githubRepositories(),
			githubUsers: r.many.githubUsers(),
			lightroomImages: r.many.lightroomImages(),
			raindropCollections: r.many.raindropCollections(),
			raindropRaindrops: r.many.raindropBookmarks(),
			readwiseDocuments: r.many.readwiseDocuments(),
			twitterTweets: r.many.twitterTweets(),
			twitterUsers: r.many.twitterUsers(),
		},
		media: {
			versionOf: r.one.media({
				from: r.media.versionOfMediaId,
				to: r.media.id,
			}),
			versions: r.many.media({
				from: r.media.id,
				to: r.media.versionOfMediaId,
			}),
			record: r.one.records({
				from: r.media.recordId,
				to: r.records.id,
			}),
			airtableAttachments: r.many.airtableAttachments(),
			lightroomImages: r.many.lightroomImages(),
			raindropImages: r.many.raindropImages(),
			twitterMedia: r.many.twitterMedia(),
		},
		raindropBookmarks: {
			collection: r.one.raindropCollections({
				from: r.raindropBookmarks.collectionId,
				to: r.raindropCollections.id,
			}),
			integrationRun: r.one.integrationRuns({
				from: r.raindropBookmarks.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.raindropBookmarks.recordId,
				to: r.records.id,
			}),
			coverImages: r.many.raindropImages({
				from: r.raindropBookmarks.id,
				to: r.raindropImages.bookmarkId,
			}),
			tags: r.many.raindropTags({
				from: r.raindropBookmarks.id.through(r.raindropBookmarkTags.bookmarkId),
				to: r.raindropTags.id.through(r.raindropBookmarkTags.tagId),
			}),
		},
		raindropBookmarkTags: {
			bookmark: r.one.raindropBookmarks({
				from: r.raindropBookmarkTags.bookmarkId,
				to: r.raindropBookmarks.id,
				optional: false,
			}),
			tag: r.one.raindropTags({
				from: r.raindropBookmarkTags.tagId,
				to: r.raindropTags.id,
				optional: false,
			}),
		},
		raindropCollections: {
			integrationRun: r.one.integrationRuns({
				from: r.raindropCollections.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.raindropCollections.recordId,
				to: r.records.id,
			}),
			children: r.many.raindropCollections({
				from: r.raindropCollections.id,
				to: r.raindropCollections.parentId,
			}),
			parent: r.one.raindropCollections({
				from: r.raindropCollections.parentId,
				to: r.raindropCollections.id,
			}),
			raindrops: r.many.raindropBookmarks({
				from: r.raindropCollections.id,
				to: r.raindropBookmarks.collectionId,
			}),
		},
		raindropImages: {
			media: r.one.media({
				from: r.raindropImages.mediaId,
				to: r.media.id,
			}),
			bookmark: r.one.raindropBookmarks({
				from: r.raindropImages.bookmarkId,
				to: r.raindropBookmarks.id,
				optional: false,
			}),
		},
		raindropTags: {
			bookmarks: r.many.raindropBookmarks({
				from: r.raindropTags.id.through(r.raindropBookmarkTags.tagId),
				to: r.raindropBookmarks.id.through(r.raindropBookmarkTags.bookmarkId),
			}),
			record: r.one.records({
				from: r.raindropTags.recordId,
				to: r.records.id,
			}),
		},
		readwiseAuthors: {
			documents: r.many.readwiseDocuments({
				from: r.readwiseAuthors.id,
				to: r.readwiseDocuments.authorId,
			}),
			record: r.one.records({
				from: r.readwiseAuthors.recordId,
				to: r.records.id,
			}),
		},
		readwiseDocuments: {
			integrationRun: r.one.integrationRuns({
				from: r.readwiseDocuments.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.readwiseDocuments.recordId,
				to: r.records.id,
			}),
			children: r.many.readwiseDocuments({
				from: r.readwiseDocuments.id,
				to: r.readwiseDocuments.parentId,
			}),
			parent: r.one.readwiseDocuments({
				from: r.readwiseDocuments.parentId,
				to: r.readwiseDocuments.id,
			}),
			author: r.one.readwiseAuthors({
				from: r.readwiseDocuments.authorId,
				to: r.readwiseAuthors.id,
			}),
			documentTags: r.many.readwiseDocumentTags({
				from: r.readwiseDocuments.id,
				to: r.readwiseDocumentTags.documentId,
			}),
		},
		readwiseDocumentTags: {
			document: r.one.readwiseDocuments({
				from: r.readwiseDocumentTags.documentId,
				to: r.readwiseDocuments.id,
				optional: false,
			}),
			tag: r.one.readwiseTags({
				from: r.readwiseDocumentTags.tagId,
				to: r.readwiseTags.id,
				optional: false,
			}),
		},
		readwiseTags: {
			documents: r.many.readwiseDocuments({
				from: r.readwiseTags.id.through(r.readwiseDocumentTags.tagId),
				to: r.readwiseDocuments.id.through(r.readwiseDocumentTags.documentId),
			}),
			record: r.one.records({
				from: r.readwiseTags.recordId,
				to: r.records.id,
			}),
		},
		records: {
			parent: r.one.records({
				from: r.records.parentId,
				to: r.records.id,
			}),
			children: r.many.records({
				from: r.records.id,
				to: r.records.parentId,
			}),
			media: r.many.media(),
			creators: r.many.recordCreators({
				from: r.records.id,
				to: r.recordCreators.recordId,
			}),
			created: r.many.recordCreators({
				from: r.records.id,
				to: r.recordCreators.creatorId,
			}),
			format: r.one.records({
				from: r.records.formatId,
				to: r.records.id,
			}),
			formatOf: r.many.records({
				from: r.records.id,
				to: r.records.formatId,
			}),
			references: r.many.recordRelations({
				from: r.records.id,
				to: r.recordRelations.sourceId,
			}),
			referencedBy: r.many.recordRelations({
				from: r.records.id,
				to: r.recordRelations.targetId,
			}),
			transcludes: r.one.records({
				from: r.records.transcludeId,
				to: r.records.id,
			}),
			transcludedBy: r.many.records({
				from: r.records.id,
				to: r.records.transcludeId,
			}),
			airtableCreators: r.many.airtableCreators(),
			airtableExtracts: r.many.airtableExtracts(),
			airtableFormats: r.many.airtableFormats(),
			airtableSpaces: r.many.airtableSpaces(),
			githubRepositories: r.many.githubRepositories(),
			githubUsers: r.many.githubUsers(),
			lightroomImages: r.many.lightroomImages(),
			raindropBookmarks: r.many.raindropBookmarks(),
			raindropCollections: r.many.raindropCollections(),
			raindropTags: r.many.raindropTags(),
			readwiseAuthors: r.many.readwiseAuthors(),
			readwiseDocuments: r.many.readwiseDocuments(),
			readwiseTags: r.many.readwiseTags(),
			twitterTweets: r.many.twitterTweets(),
			twitterUsers: r.many.twitterUsers(),
		},
		recordCreators: {
			creator: r.one.records({
				from: r.recordCreators.creatorId,
				to: r.records.id,
				optional: false,
			}),
			record: r.one.records({
				from: r.recordCreators.recordId,
				to: r.records.id,
				optional: false,
			}),
		},
		recordRelations: {
			source: r.one.records({
				from: r.recordRelations.sourceId,
				to: r.records.id,
				optional: false,
			}),
			target: r.one.records({
				from: r.recordRelations.targetId,
				to: r.records.id,
				optional: false,
			}),
		},
		twitterMedia: {
			media: r.one.media({
				from: r.twitterMedia.mediaId,
				to: r.media.id,
			}),
			tweet: r.one.twitterTweets({
				from: r.twitterMedia.tweetId,
				to: r.twitterTweets.id,
				optional: false,
			}),
		},
		twitterTweets: {
			integrationRun: r.one.integrationRuns({
				from: r.twitterTweets.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.twitterTweets.recordId,
				to: r.records.id,
			}),
			media: r.many.twitterMedia({
				from: r.twitterTweets.id,
				to: r.twitterMedia.tweetId,
			}),
			user: r.one.twitterUsers({
				from: r.twitterTweets.userId,
				to: r.twitterUsers.id,
				optional: false,
			}),
			quotedTweet: r.one.twitterTweets({
				from: r.twitterTweets.quotedTweetId,
				to: r.twitterTweets.id,
			}),
			quotedBy: r.many.twitterTweets({
				from: r.twitterTweets.id,
				to: r.twitterTweets.quotedTweetId,
			}),
		},
		twitterUsers: {
			integrationRun: r.one.integrationRuns({
				from: r.twitterUsers.integrationRunId,
				to: r.integrationRuns.id,
			}),
			record: r.one.records({
				from: r.twitterUsers.recordId,
				to: r.records.id,
			}),
			tweets: r.many.twitterTweets({
				from: r.twitterUsers.id,
				to: r.twitterTweets.userId,
			}),
		},
	})
);
