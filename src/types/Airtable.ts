import type { Attachment, FieldSet, Record } from 'airtable';

// const AirtableBaseId = 'appHWZbECVKCSjquH' as const;
export const AirtableBaseId = 'appNAUPSEyCYlPtvG' as const;

export enum Table {
	Extracts = 'tblACVIEZW68A1mMZ',
	Creators = 'tblWPCpPglI6ssVZv',
	Spaces = 'tblDQjXO9oy2TKTqL',
	Assemblages = 'tbl9R62MN7hQ6nOGw'
}

export enum ExtractView {
	Best = 'viwCvae2rXQscUap6',
	ByEntryDate = 'viwLItZEyHOGtcoHe',
	Gallery = 'viwEHJGOwWKp7Zebc',
	Works = 'viwTkCBV6uRoHplvP',
	EntryView = 'viw4zAxRJhQbhTddm',
	Feed = 'viwAdvAy1vJlbCVas'
}
export enum CreatorView {
	Alphabetical = 'viwGZDVJxyNDDfOjV',
	Best = 'viwxE8m6ZZM5CfhB7',
	ByCount = 'viwcIFF6YBJV0SgE1',
	ByStars = 'viwdUV8VFOvylVdtY',
	RecentlyUpdated = 'viw8aHvPsBm7AJfcC'
}
export enum SpaceView {
	Alphabetical = 'viwXFuJApmneAzKEh',
	Best = 'viwdhSigvrkEJBvOH',
	ByCount = 'viw6rBrUfPPkrqMVC',
	ByStars = 'viwYHuokhqY6LpWb3',
	RecentlyUpdated = 'viwmSxAVAT3uJc6xk'
}

type AirtableRecordId = Record<FieldSet>['id'];

export interface IBaseRecord {
	id: AirtableRecordId;
	[key: string]: FieldSet[keyof FieldSet] | ILinkedRecord[];
}

export interface ILinkedRecord {
	id: AirtableRecordId;
	name: string;
}
