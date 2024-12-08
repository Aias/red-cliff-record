import Airtable from 'airtable';
import { loadEnv } from '@rcr/lib/env';

loadEnv();

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN,
});

export const airtableBase = Airtable.base('apptgvbgopj0Mwf9Z');
