import type { Attachment, FieldSet } from 'airtable';

export interface ExtractFieldSet extends FieldSet {
	id: string;
	title: string;
	format: string; // Single-select comes back as string
	michelinStars?: number;
	source?: string;
	creators?: string[]; // Array of Creator record IDs
	extract?: string;
	parent?: string[]; // Array of Extract record IDs
	children?: string[]; // Array of Extract record IDs
	spaces?: string[]; // Array of Space record IDs
	connections?: string[]; // Array of Extract record IDs
	images?: Attachment[];
	imageCaption?: string;
	notes?: string;
	extractedOn: string; // ISO date string
	lastUpdated: string; // ISO date string
	published: boolean;
	publishedOn?: string; // ISO date string
	numChildren: number;
	numFragments: number;
	spaceTopics?: string[];
	connectionTitles?: string[];
	childTitles?: string[];
	creatorNames?: string[];
	parentTitle?: string[];
	parentCreatorNames?: string[];
	parentCreatorIds?: string[];
	parentId?: string[];
	creatorIds?: string[];
	spaceIds?: string[];
	connectionIds?: string[];
	childIds?: string[];
	creatorsLookup?: string;
	spacesLookup?: string;
	search: string;
	extractsLookup: string;
	slug: string;
	score: number;
	hasImages: number;
}

export interface CreatorFieldSet extends FieldSet {
	id: string;
	name: string;
	type?: string; // Single-select comes back as string
	primaryProject?: string;
	site?: string;
	professions?: string[]; // Multi-select comes back as string[]
	organizations?: string[];
	nationality?: string[];
	extracts?: string[]; // Array of Extract record IDs
	numExtracts: number;
	createdTime: string; // ISO date string
	numWorks: number;
	extractTitles?: string[];
	numFragments: number;
	lastUpdated: string; // ISO date string
	extractIds?: string[];
	totalStars: number;
	slug: string;
	relevance: number;
	starred: boolean;
	extractScore: number;
}

export interface SpaceFieldSet extends FieldSet {
	id: string;
	topic: string;
	icon?: string;
	title?: string;
	description?: string;
	extracts?: string[]; // Array of Extract record IDs
	numExtracts: number;
	lastUpdated: string; // ISO date string
	extractIds?: string[];
	extractTitles?: string[];
	createdTime: string; // ISO date string
	totalStars: number;
	slug: string;
	extractScore: number;
	relevance: number;
}
