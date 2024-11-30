import Airtable from 'airtable';

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN,
});

export const base = Airtable.base('apptgvbgopj0Mwf9Z');
