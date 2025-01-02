import Airtable from 'airtable';
import 'dotenv/config';

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN,
});

export const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID_BWB!);
