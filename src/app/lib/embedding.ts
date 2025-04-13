import type { FullRecord } from '@/server/api/routers/records.types';

const truncateText = (text: string, maxLength: number = 200) => {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength) + '...';
};

const trimBreaks = (text: string) => {
	return text.replace(/\n/g, ' ').trim();
};

export const getRecordTitle = (record: Partial<FullRecord>, maxLength: number = 200) => {
	const { title, abbreviation, sense, content, summary } = record;

	if (title) {
		const titleParts = [title];
		if (abbreviation) {
			titleParts.push(`(${abbreviation})`);
		}
		if (sense) {
			titleParts.push(`*${sense}*`);
		}
		return titleParts.join(' ');
	}

	if (summary) {
		return truncateText(trimBreaks(summary), maxLength);
	}

	if (content) {
		return truncateText(trimBreaks(content), maxLength);
	}

	return 'Untitled Record';
};

export const createRecordEmbeddingText = (record: FullRecord) => {
	const {
		title,
		content,
		summary,
		notes,
		mediaCaption,
		creators,
		created,
		format,
		parent,
		children,
		media,
		references,
		referencedBy,
		url,
	} = record;

	const textParts = [];

	if (title) {
		textParts.push(`# ${getRecordTitle(record)}`);
	}

	const metaParts = [];
	if (creators.length > 0) {
		metaParts.push(`Created By: ${creators.map((c) => getRecordTitle(c)).join(', ')}`);
	}
	if (created.length > 0) {
		metaParts.push(`Creator Of:\n - ${created.map((c) => getRecordTitle(c)).join('\n - ')}`);
	}
	if (format) {
		metaParts.push(`Format: ${getRecordTitle(format)}`);
	}
	if (url) {
		metaParts.push(`URL: ${url}`);
	}
	if (metaParts.length > 0) {
		textParts.push(metaParts.join('\n'));
	}

	const contentParts = [];
	if (parent) {
		contentParts.push(`From: ${getRecordTitle(parent)}`);
	}
	if (summary) {
		contentParts.push(`**${summary}**`);
	}
	if (content) {
		contentParts.push(`${content}`);
	}
	if (mediaCaption && media.length > 0) {
		contentParts.push(`${mediaCaption}`);
	}
	if (children.length > 0) {
		contentParts.push(
			`Children:\n - ${children.map((c) => getRecordTitle(c, 1000)).join('\n - ')}`
		);
	}
	if (references.length > 0) {
		contentParts.push(`References:\n - ${references.map((r) => getRecordTitle(r)).join('\n - ')}`);
	}
	if (referencedBy.length > 0) {
		contentParts.push(
			`Referenced By:\n - ${referencedBy.map((r) => getRecordTitle(r)).join('\n - ')}`
		);
	}
	if (notes) {
		contentParts.push(`[Note:] ${notes}`);
	}
	if (contentParts.length > 0) {
		textParts.push(contentParts.join('\n\n'));
	}

	return textParts.join('\n\n');
};
