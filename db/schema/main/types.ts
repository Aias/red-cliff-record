import { z } from 'zod';

export const TimepointType = z.enum([
	'instant',
	'minute',
	'hour',
	'day',
	'week',
	'month',
	'quarter',
	'year',
	'decade',
	'century',
]);
export type TimepointType = z.infer<typeof TimepointType>;

export const LinkMetadataSchema = z
	.object({
		linkText: z.string().optional(),
		attributes: z.record(z.string()).optional(),
	})
	.strict();
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

export const MediaFormat = z.enum([
	'image', // images (jpg, png, etc)
	'video', // video files
	'audio', // audio files
	'text', // plain text, markdown
	'application', // binary data, PDFs, etc
	'unknown', // unknown format
]);
export type MediaFormat = z.infer<typeof MediaFormat>;

export const IndexMainType = z.enum([
	'entity', // who/what created something
	'category', // what something is about
	'format', // what something is
]);
export type IndexMainType = z.infer<typeof IndexMainType>;

export const IndexRelationType = z.enum(['related_to', 'opposite_of', 'part_of']);
export type IndexRelationType = z.infer<typeof IndexRelationType>;

export const FLAGS = {
	important: {
		name: 'Important',
		emoji: '⭐',
		description: 'Important content',
	},
	favorite: {
		name: 'Favorite',
		emoji: '💖',
		description: 'Favorite content',
	},
	draft: {
		name: 'Draft',
		emoji: '📝',
		description: 'Work in progress',
	},
	follow_up: {
		name: 'Follow-up',
		emoji: '🚩',
		description: 'Needs further action',
	},
	review: {
		name: 'Review',
		emoji: '⏲️',
		description: 'Marked for later review',
	},
	outdated: {
		name: 'Outdated',
		emoji: '📅',
		description: 'Content needs updating',
	},
} as const;

export const Flag = z.enum(
	Object.keys(FLAGS) as [keyof typeof FLAGS, ...Array<keyof typeof FLAGS>]
);
export type Flag = z.infer<typeof Flag>;

// Type safety
export type FlagData = typeof FLAGS;
export type FlagKey = keyof FlagData;

export const RecordType = z.enum([
	'resource', // reference material, tools, techniques
	'bookmark', // interesting but not reference material
	'object', // physical or digital object
	'document', // text-heavy content
	'abstraction', // concept or idea
	'extracted', // quote or excerpt
	'event', // point in time or occurrence of an event
]);
export type RecordType = z.infer<typeof RecordType>;

export const CreatorRoleType = z.enum([
	'creator', // primary creator
	'author', // specifically wrote/authored
	'editor', // edited/curated
	'contributor', // helped create/contributed to
	'via', // found through/attributed to
	'participant', // involved in
	'interviewer', // conducted interview
	'interviewee', // was interviewed
	'subject', // topic is about this person
	'mentioned', // referenced in content
]);
export type CreatorRoleType = z.infer<typeof CreatorRoleType>;

export const RecordRelationType = z.enum([
	// Hierarchical
	'primary_source',
	'quoted_from',
	'copied_from',
	'derived_from',
	'part_of',
	// Non-hierarchical
	'references',
	'similar_to',
	'responds_to',
	'contradicts',
	'supports',
]);
export type RecordRelationType = z.infer<typeof RecordRelationType>;

export const CategorizationType = z.enum([
	'about', // meta-level subject matter
	'file_under', // organizational category
]);
export type CategorizationType = z.infer<typeof CategorizationType>;
