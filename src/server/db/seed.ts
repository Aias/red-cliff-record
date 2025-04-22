import type { PredicateInsert, RecordInsert } from './schema/records';

export const recordSeed = [
	{
		slug: 'nick-trombley',
		title: 'Nick Trombley',
		type: 'entity',
	},
] as const satisfies ReadonlyArray<RecordInsert>;

export type RecordSlug = (typeof recordSeed)[number]['slug'];

export const predicateSeed = [
	/* ─────────── Creation ─────────── */
	{
		slug: 'created_by',
		name: 'created by',
		type: 'creation',
		role: 'creator',
		inverseSlug: 'created',
	},
	{
		slug: 'created',
		name: 'created',
		type: 'creation',
		role: 'creator',
		inverseSlug: 'created_by',
	},
	{ slug: 'via', name: 'via', type: 'creation', role: 'via', inverseSlug: undefined },
	{
		slug: 'edited_by',
		name: 'edited by',
		type: 'creation',
		role: 'editor',
		inverseSlug: undefined,
	},

	/* ───────── Containment (child → parent) ───────── */
	{ slug: 'contained_by', name: 'contained by', type: 'containment', inverseSlug: 'contains' },
	{ slug: 'contains', name: 'contains', type: 'containment', inverseSlug: 'contained_by' },
	{ slug: 'quotes', name: 'quotes', type: 'containment', inverseSlug: undefined },
	{ slug: 'transcludes', name: 'transcludes', type: 'containment', inverseSlug: undefined },

	/* ───────── Description ───────── */
	{ slug: 'about', name: 'about', type: 'description', inverseSlug: undefined },
	{ slug: 'tagged_with', name: 'tagged with', type: 'description', inverseSlug: undefined },

	/* ───────── Reference ───────── */
	{ slug: 'references', name: 'references', type: 'reference', inverseSlug: 'referenced_by' },
	{ slug: 'referenced_by', name: 'referenced by', type: 'reference', inverseSlug: 'references' },

	/* ───────── Association ───────── */
	{ slug: 'related_to', name: 'related to', type: 'association', inverseSlug: 'related_to' },
	{ slug: 'example_of', name: 'example of', type: 'association', inverseSlug: 'examples' },
	{ slug: 'examples', name: 'examples', type: 'association', inverseSlug: 'example_of' },

	/* ───────── Identity (format) ───────── */
	{ slug: 'has_format', name: 'has format', type: 'identity', inverseSlug: 'format_of' },
	{ slug: 'format_of', name: 'format of', type: 'identity', inverseSlug: 'has_format' },
	{ slug: 'instance_of', name: 'instance of', type: 'identity', inverseSlug: 'has_instance' },
	{ slug: 'has_instance', name: 'has instance', type: 'identity', inverseSlug: 'instance_of' },
	{ slug: 'same_as', name: 'same as', type: 'identity', inverseSlug: 'same_as' },
] as const satisfies ReadonlyArray<PredicateInsert>;

export type PredicateSlug = (typeof predicateSeed)[number]['slug'];
