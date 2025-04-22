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
	const { title, content, summary, notes, mediaCaption, outgoingLinks, incomingLinks, media, url } =
		record;

	const creators = outgoingLinks
		.filter((link) => link.predicate.type === 'creation')
		.map((link) => link.target);
	const created = incomingLinks
		.filter((link) => link.predicate.type === 'creation')
		.map((link) => link.source);
	const formats = outgoingLinks
		.filter((link) => link.predicate.type === 'identity')
		.map((link) => link.target);
	const parents = outgoingLinks
		.filter((link) => link.predicate.type === 'containment')
		.map((link) => link.target);
	const children = incomingLinks
		.filter((link) => link.predicate.type === 'containment')
		.map((link) => link.source);
	const associations = outgoingLinks
		.filter((link) => link.predicate.type === 'association')
		.map((link) => link.target);
	const tags = outgoingLinks
		.filter((link) => link.predicate.type === 'description')
		.map((link) => link.target);

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
	if (formats.length > 0) {
		metaParts.push(`Format: ${formats.map((f) => getRecordTitle(f)).join(', ')}`);
	}
	if (url) {
		metaParts.push(`URL: ${url}`);
	}
	if (metaParts.length > 0) {
		textParts.push(metaParts.join('\n'));
	}

	const contentParts = [];
	if (parents.length > 0) {
		contentParts.push(`From: ${parents.map((p) => getRecordTitle(p)).join(', ')}`);
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
	if (associations.length > 0) {
		contentParts.push(
			`Associations:\n - ${associations.map((a) => getRecordTitle(a)).join('\n - ')}`
		);
	}
	if (tags.length > 0) {
		contentParts.push(`Tags:\n - ${tags.map((t) => getRecordTitle(t)).join('\n - ')}`);
	}
	if (notes) {
		contentParts.push(`[Note:] ${notes}`);
	}
	if (contentParts.length > 0) {
		textParts.push(contentParts.join('\n\n'));
	}

	const finalText = textParts.join('\n\n');

	return finalText;
};
