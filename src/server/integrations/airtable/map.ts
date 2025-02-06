import { and, eq, isNull, or } from 'drizzle-orm';
import { validateAndFormatUrl } from '~/app/lib/formatting';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { db } from '~/server/db/connections/postgres';
import {
	indices,
	media,
	records,
	type AirtableAttachmentSelect,
	type AirtableCreatorSelect,
	type AirtableExtractSelect,
	type AirtableSpaceSelect,
	type IndicesInsert,
	type MediaInsert,
	type RecordInsert,
} from '~/server/db/schema';

const mapAirtableExtractToRecord = (extract: AirtableExtractSelect): RecordInsert => {
	return {
		title: extract.title,
		content: extract.content,
		url: extract.source,
		flags:
			extract.michelinStars > 2
				? ['favorite']
				: extract.michelinStars > 0
					? ['important']
					: undefined,
		notes: extract.notes,
		mediaCaption: extract.attachmentCaption,
		needsCuration: false,
		isPrivate: extract.publishedAt ? false : true,
		recordCreatedAt: extract.recordCreatedAt,
		recordUpdatedAt: extract.recordUpdatedAt,
		contentCreatedAt: extract.contentCreatedAt,
		contentUpdatedAt: extract.contentUpdatedAt,
	};
};

const mapAirtableCreatorToIndexEntry = (creator: AirtableCreatorSelect): IndicesInsert => {
	return {
		name: creator.name,
		canonicalUrl: creator.website ? validateAndFormatUrl(creator.website) : undefined,
		mainType: 'entity',
		needsCuration: false,
		isPrivate: false,
		recordCreatedAt: creator.recordCreatedAt,
		recordUpdatedAt: creator.recordUpdatedAt,
		contentCreatedAt: creator.contentCreatedAt,
		contentUpdatedAt: creator.contentUpdatedAt,
	};
};

const mapAirtableSpaceToIndexEntry = (space: AirtableSpaceSelect): IndicesInsert => {
	return {
		name: space.name,
		notes: [space.icon, space.fullName].filter(Boolean).join(' ') || undefined,
		mainType: 'category',
		needsCuration: false,
		isPrivate: false,
		recordCreatedAt: space.recordCreatedAt,
		recordUpdatedAt: space.recordUpdatedAt,
		contentCreatedAt: space.contentCreatedAt,
		contentUpdatedAt: space.contentUpdatedAt,
	};
};

const mapAirtableAttachmentToMedia = async (
	attachment: AirtableAttachmentSelect,
	extract?: AirtableExtractSelect
): Promise<MediaInsert> => {
	const { size, width, height, mediaFormat, mediaType, contentTypeString } = await getSmartMetadata(
		attachment.url
	);

	return {
		url: attachment.url,
		type: mediaType,
		format: mediaFormat,
		contentTypeString,
		fileSize: size,
		width,
		height,
		isPrivate: false,
		needsCuration: true,
		recordCreatedAt: attachment.recordCreatedAt,
		recordUpdatedAt: attachment.recordUpdatedAt,
		contentCreatedAt: extract?.contentCreatedAt || attachment.recordCreatedAt,
		contentUpdatedAt: extract?.contentUpdatedAt || attachment.recordUpdatedAt,
	};
};
