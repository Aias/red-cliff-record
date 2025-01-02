import { z } from 'zod';

export const IntegrationStatus = z.enum(['success', 'fail', 'in_progress']);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const IntegrationType = z.enum([
	'ai_chat',
	'airtable',
	'browser_history',
	'crawler',
	'github',
	'lightroom',
	'manual',
	'raindrop',
	'readwise',
	'twitter',
]);
export type IntegrationType = z.infer<typeof IntegrationType>;

export const RunType = z.enum(['seed', 'sync']);
export type RunType = z.infer<typeof RunType>;
